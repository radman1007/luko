"""
تحلیلِ هوشمندِ گزارشِ والد.

جریان: گزارشِ قفل‌شده (gate_report) → برگه‌ی داده (facts) → یک درخواست به مدل (پس‌زمینه، صفِ «ai»)
→ پذیرشِ بخش‌به‌بخش (validate) → ذخیره در AIInsight. هنگامِ نمایش اگر اثرِ داده همان باشد متن‌های
مدل جای متن‌های قاعده‌محور می‌نشینند؛ وگرنه همان قاعده‌ها نشان داده می‌شوند و تحلیلِ تازه در صف می‌رود.

مدل: پلنِ رایگان همیشه «پایه» (DeepSeek-V4-Flash)؛ فرزندِ مشترک AI_INSIGHT_TIER_PREMIUM (پیش‌فرض
«پیشرفته»، GPT-5.6-Luna) و اگر نشد «پایه». عددها و نمره‌ها همیشه از قاعده‌ها می‌آیند؛ مدل فقط روایت می‌کند.
"""
from __future__ import annotations

import logging

from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

from apps.common.fa import fa_when

from . import client
from .facts import build_facts, fingerprint
from .models import AIInsight
from .prompts import insight_prompt, insight_sections
from .text import NAME_TOKEN, extract_json
from .validate import validate_bundle

log = logging.getLogger(__name__)

#: تا این مدت پس از صف‌کردن دوباره صف نمی‌کنیم؛ شکست هم این‌قدر به خاطر می‌ماند
PENDING_TTL = 10 * 60
FAILED_TTL = 30 * 60


def variant_of(premium: bool) -> str:
    return AIInsight.Variant.FULL if premium else AIInsight.Variant.FREE


def tier_for(premium: bool) -> str:
    tier = settings.AI_INSIGHT_TIER_PREMIUM if premium else "flash"
    return tier if tier in client.TIERS else "flash"


def _state_key(child_id: int, variant: str, fp: str) -> str:
    return f"ai:insight:{child_id}:{variant}:{fp[:20]}"


# ---------------------------------------------------------------- ساختن (پس‌زمینه)
def generate(child, premium: bool, fp_hint: str = "") -> AIInsight | None:
    """
    تحلیلِ تازه برای یک بچه. اگر داده همان قبلی باشد درخواستی فرستاده نمی‌شود.
    None یعنی چیزی برای تحلیل نبود یا مدل‌ها نتوانستند.
    """
    from apps.parent.gating import gate_report
    from apps.parent.services import build_child_report

    variant = variant_of(premium)
    report = gate_report(build_child_report(child), premium)
    facts = build_facts(report, premium=premium, grade=child.grade)
    if facts is None:
        return None
    fp = fingerprint(facts)
    existing = AIInsight.objects.filter(child=child, variant=variant).first()
    if existing and existing.fingerprint == fp:
        return existing

    prompt = insight_prompt(facts)
    sections = insight_sections(facts)
    tiers = [tier_for(premium)]
    if tiers[0] != "flash":
        tiers.append("flash")  # پشتیبان: اگر مدلِ بهتر نشد، پایه
    accepted, rejected, used = {}, {}, None
    for tier in tiers:
        try:
            result = client.complete(tier, prompt, feature="insight", child=child, temperature=0.4)
        except client.AIError as error:
            rejected = {"_request": error.code}
            continue
        accepted, rejected = validate_bundle(extract_json(result.text), facts, sections)
        if accepted:
            used = result
            break
    if not accepted or used is None:
        log.warning("ai insight for child %s (%s) failed: %s", child.pk, variant, rejected)
        for key in {fp_hint, fp} - {""}:
            cache.set(_state_key(child.pk, variant, key), "failed", FAILED_TTL)
        return None

    insight, _ = AIInsight.objects.update_or_create(
        child=child, variant=variant,
        defaults={"fingerprint": fp, "tier": used.tier, "model": used.model, "payload": accepted,
                  "rejected": rejected},
    )
    return insight


def schedule(child_id: int, premium: bool, fp: str) -> str:
    """صف‌کردنِ تحلیل (حداکثر یک بار در هر ده دقیقه برای همان داده). وضعیت: pending | failed | off"""
    key = _state_key(child_id, variant_of(premium), fp)
    state = cache.get(key)
    if state == "failed":
        return "failed"
    if state is None:
        from .tasks import generate_insight

        # پیش از صف‌کردن: کارگرِ تند ممکن است «failed» را زودتر از این بنویسد
        cache.set(key, "pending", PENDING_TTL)
        try:
            generate_insight.delay(child_id, premium, fp)
        except Exception:  # noqa: BLE001 — بروکر در دسترس نیست؛ والد همان قاعده‌ها را می‌بیند
            log.exception("could not queue ai insight")
            cache.delete(key)
            return "off"
        return cache.get(key) or "pending"
    return "pending"


# ---------------------------------------------------------------- نمایش
def _named(value, name: str):
    if isinstance(value, str):
        return value.replace(NAME_TOKEN, name)
    if isinstance(value, list):
        return [_named(item, name) for item in value]
    if isinstance(value, dict):
        return {key: _named(item, name) for key, item in value.items()}
    return value


def _tips(items: list[dict], prefix: str, premium: bool) -> list[dict]:
    from apps.parent.gating import FREE_TIPS

    out = []
    for index, tip in enumerate(items):
        row = {"id": f"{prefix}-{index + 1}", **tip}
        if not premium and prefix == "ai" and index >= FREE_TIPS:
            row = {"id": row["id"], "kind": row["kind"], "title": row["title"], "body": "", "locked": True}
        out.append(row)
    return out


def merge(report: dict, insight: AIInsight, *, name: str, premium: bool) -> dict:
    """متن‌های مدل جای متن‌های قاعده‌محور؛ عددها، نمره‌ها و قفل‌ها دست‌نخورده می‌مانند"""
    payload = _named(insight.payload, name)
    out = dict(report)

    weekly = out.get("weekly")
    if payload.get("weekly") and weekly and weekly.get("active"):
        out["weekly"] = {**weekly, **payload["weekly"], "source": "ai"}

    if payload.get("tips"):
        out["tips"] = {"source": "ai", "items": _tips(payload["tips"], "ai", premium)}

    if payload.get("analysis"):
        out["aiAnalysis"] = payload["analysis"]

    health = out.get("health")
    if health:
        health = dict(health)
        if payload.get("health") and (health.get("weekly") or {}).get("verdict") not in (None, "none"):
            ai = payload["health"]
            health["weekly"] = {
                **health["weekly"], "title": ai["title"], "body": ai["body"], "source": "ai",
                "tips": _tips(ai["tips"], "ai-mood", True) if ai.get("tips") else health["weekly"].get("tips", []),
            }
        daily = health.get("daily") or {}
        if premium and payload.get("health_daily_tips") and not daily.get("locked"):
            health["daily"] = {**daily, "tips": _tips(payload["health_daily_tips"], "ai-day", True)}
        out["health"] = health

    meta = client.TIERS.get(insight.tier, client.TIERS["flash"])
    out["ai"] = {
        "status": "ready",
        "tier": insight.tier,
        "tierLabel": meta["label"],
        "modelName": meta["name"],
        "generatedFa": fa_when(timezone.localtime(insight.updated_at), timezone.localdate()),
    }
    return out


def attach(report: dict, *, child, premium: bool) -> dict:
    """
    روی گزارشِ قفل‌شده‌ی والد صدا زده می‌شود (ChildReportView). یک کوئری؛ کارِ سنگین در صف است.
    """
    if not client.enabled():
        return {**report, "ai": {"status": "off"}}
    facts = build_facts(report, premium=premium, grade=child.grade)
    if facts is None:
        # هفته‌ی بی‌بازی و بی‌ثبتِ حال: همان متنِ دعوت کافی است
        return {**report, "ai": {"status": "off"}}
    fp = fingerprint(facts)
    insight = AIInsight.objects.filter(child=child, variant=variant_of(premium)).first()
    name = (child.first_name or "").strip() or "فرزندتان"
    if insight and insight.fingerprint == fp:
        return merge(report, insight, name=name, premium=premium)
    return {**report, "ai": {"status": schedule(child.pk, premium, fp)}}
