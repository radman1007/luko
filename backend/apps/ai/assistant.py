"""
دستیارِ هوشمندِ والدین: گفت‌وگو درباره‌ی یک فرزند، با پاسخی که از گزارشِ همان بچه ساخته می‌شود.

- مدل: «پایه» برای همه؛ «حرفه‌ای» و «پیشرفته» فقط برای فرزندِ مشترک. سهمیه‌ی روزانه‌ی هر والد
  برای هر سطح جداست (settings.AI_QUOTA_*). پاسخِ ناموفق از سهمیه کم نمی‌شود.
- پرسش در صفِ «ai» پاسخ داده می‌شود؛ فرانت تا آمدنِ پاسخ گفت‌وگو را دوباره می‌خواند.
- داده‌ی بچه همان گزارشِ قفل‌شده‌ی والد است (پلنِ رایگان فقط درس‌های باز). نامِ بچه به مدل
  نمی‌رود: در پرسش و تاریخچه به «[نام]» برمی‌گردد و در پاسخ دوباره جای خودش می‌نشیند.
"""
from __future__ import annotations

import re
from datetime import datetime, time, timedelta

from django.conf import settings
from django.db.models import Count
from django.utils import timezone

from apps.common.fa import fa_when

from . import client
from .facts import GRADE_FA, build_facts
from .models import AssistantMessage
from .prompts import assistant_prompt
from .text import NAME_TOKEN
from .validate import clean_reply

QUESTION_MAX = 800
HISTORY_MESSAGES = 8
HISTORY_CHARS = 700
#: پاسخی که این‌قدر در صف مانده دیگر نمی‌رسد (کارگر افتاده یا گیت‌وی جواب نداد)
STALE_AFTER = timedelta(minutes=4)
SHOWN = 60


class AssistantError(Exception):
    def __init__(self, code: str, message: str, status: int = 400):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status


def is_premium(child) -> bool:
    from apps.billing.services import subscription

    return subscription(child).active


def _today_start():
    return timezone.make_aware(datetime.combine(timezone.localdate(), time.min))


def quota(parent, premium: bool) -> dict:
    used = dict(
        AssistantMessage.objects.filter(
            parent=parent, role=AssistantMessage.Role.ASSISTANT, created_at__gte=_today_start(),
        ).exclude(status=AssistantMessage.Status.FAILED).values_list("tier").annotate(n=Count("id"))
    )
    tiers = []
    for key, meta in client.TIERS.items():
        locked = meta["premium"] and not premium
        if locked:
            limit = 0
        elif premium:
            limit = settings.AI_QUOTA_PREMIUM.get(key, 0)
        else:
            limit = settings.AI_QUOTA_FREE
        tiers.append({
            "key": key, "label": meta["label"], "name": meta["name"], "locked": locked,
            "used": used.get(key, 0), "limit": limit, "left": max(0, limit - used.get(key, 0)),
        })
    return {"premium": premium, "tiers": tiers, "freeLimit": settings.AI_QUOTA_FREE,
            "premiumLimits": settings.AI_QUOTA_PREMIUM}


def _anonymize(text: str, name: str) -> str:
    """نامِ بچه را (فقط کلمه‌ی کامل) با «[نام]» عوض می‌کند تا به مدل نرود"""
    name = (name or "").strip()
    if len(name) < 2:
        return text
    return re.sub(rf"(?<![\w‌]){re.escape(name)}(?![\w‌])", NAME_TOKEN, text)


def _expire_stale(parent, child) -> None:
    AssistantMessage.objects.filter(
        parent=parent, child=child, status=AssistantMessage.Status.PENDING,
        created_at__lt=timezone.now() - STALE_AFTER,
    ).update(status=AssistantMessage.Status.FAILED, error="timeout",
             content="پاسخ نرسید؛ لطفاً دوباره بپرسید.")


def message_row(message: AssistantMessage) -> dict:
    meta = client.TIERS.get(message.tier) if message.tier else None
    return {
        "id": message.id,
        "role": message.role,
        "content": message.content,
        "status": message.status,
        "tier": message.tier,
        "tierLabel": meta["label"] if meta else "",
        "modelName": meta["name"] if meta else "",
        "atFa": fa_when(timezone.localtime(message.created_at), timezone.localdate()),
    }


def suggestions(report: dict, premium: bool) -> list[str]:
    """پرسش‌های پیشنهادی از روی داده‌ی همین بچه (بی‌هزینه، بی‌مدل)"""
    facts = build_facts(report, premium=premium) or {}
    week = facts.get("week") or {}
    out = []
    weak = [c for c in facts.get("concepts_last_8_weeks") or [] if c["answers"] >= 5 and c["accuracy_percent"] < 70]
    if weak:
        out.append(f"چطور در «{weak[0]['name']}» کمکش کنم؟")
    if week.get("late_night_activity_percent", 0) >= 30:
        out.append("چطور بازی‌های آخرِ شبش را به عصر ببرم؟")
    if facts.get("played_this_week") and week.get("active_days_of_7", 7) <= 2:
        out.append("چطور بازیِ روزانه را برایش عادت کنم؟")
    mood = (facts.get("mood_this_week") or {}).get("most_common_mood")
    if mood in {"خسته", "ناراحت", "عصبانی"}:
        out.append(f"این هفته بیشتر «{mood}» بود؛ چه کنم؟")
    out += ["این هفته در چه چیزی بهتر شد؟", "برای هفته‌ی بعد چه برنامه‌ای پیشنهاد می‌کنی؟",
            "چطور تشویقش کنم بدونِ این‌که فقط به نمره فکر کند؟"]
    seen, unique = set(), []
    for item in out:
        if item not in seen:
            seen.add(item)
            unique.append(item)
    return unique[:4]


def thread(parent, child) -> dict:
    from apps.parent.gating import gate_report
    from apps.parent.services import build_child_report

    _expire_stale(parent, child)
    premium = is_premium(child)
    rows = list(AssistantMessage.objects.filter(parent=parent, child=child).order_by("-created_at", "-id")[:SHOWN])
    rows.reverse()
    report = gate_report(build_child_report(child), premium)
    return {
        "enabled": client.enabled(),
        "messages": [message_row(m) for m in rows],
        "pending": any(m.status == AssistantMessage.Status.PENDING for m in rows),
        "quota": quota(parent, premium),
        "suggestions": suggestions(report, premium),
    }


def ask(parent, child, text: str, tier: str) -> tuple[AssistantMessage, AssistantMessage]:
    if not client.enabled():
        raise AssistantError("disabled", "دستیار فعلاً در دسترس نیست.", 503)
    text = (text or "").strip()
    if len(text) < 2:
        raise AssistantError("empty", "پرسشتان را بنویسید.")
    if len(text) > QUESTION_MAX:
        raise AssistantError("too-long", f"پرسش حداکثر {QUESTION_MAX} نویسه باشد.")
    if tier not in client.TIERS:
        tier = "flash"
    premium = is_premium(child)
    row = next(t for t in quota(parent, premium)["tiers"] if t["key"] == tier)
    if row["locked"]:
        raise AssistantError("locked", f"مدلِ «{row['label']}» با اشتراکِ همین فرزند باز می‌شود.", 403)
    if row["left"] <= 0:
        raise AssistantError("quota", f"سهمیه‌ی امروزِ مدلِ «{row['label']}» تمام شده؛ فردا دوباره می‌توانید بپرسید.",
                             429)
    _expire_stale(parent, child)
    if AssistantMessage.objects.filter(parent=parent, status=AssistantMessage.Status.PENDING).exists():
        raise AssistantError("busy", "دستیار هنوز به پرسشِ قبلی پاسخ می‌دهد.", 409)

    question = AssistantMessage.objects.create(parent=parent, child=child, role=AssistantMessage.Role.USER,
                                               content=text)
    reply = AssistantMessage.objects.create(parent=parent, child=child, role=AssistantMessage.Role.ASSISTANT,
                                            tier=tier, model=client.model_of(tier),
                                            status=AssistantMessage.Status.PENDING)
    from .tasks import answer_question

    try:
        answer_question.delay(reply.pk)
    except Exception:  # noqa: BLE001
        reply.status = AssistantMessage.Status.FAILED
        reply.error = "queue"
        reply.content = "پاسخ نرسید؛ لطفاً دوباره بپرسید."
        reply.save(update_fields=["status", "error", "content", "updated_at"])
    return question, reply


def answer(reply_id: int) -> AssistantMessage | None:
    """کارِ صف: ساختنِ پاسخ برای یک پیامِ در انتظار"""
    from apps.parent.gating import gate_report
    from apps.parent.services import build_child_report

    reply = AssistantMessage.objects.select_related("parent", "child").filter(
        pk=reply_id, status=AssistantMessage.Status.PENDING).first()
    if reply is None:
        return None
    child, parent = reply.child, reply.parent
    name = (child.first_name or "").strip()
    premium = is_premium(child)
    report = gate_report(build_child_report(child), premium)
    facts = build_facts(report, premium=premium, grade=child.grade)
    if facts is None:
        facts = {"plan": "full" if premium else "free",
                 "grade": f"{GRADE_FA.get(child.grade, '')} دبستان".strip(),
                 "note": "no play and no mood check-in in the last 7 days"}
        if not premium:
            facts["locked_subjects"] = [s["label"] for s in report.get("subjects") or [] if s.get("locked")]

    earlier = list(
        AssistantMessage.objects.filter(parent=parent, child=child, created_at__lte=reply.created_at)
        .exclude(pk=reply.pk).exclude(status=AssistantMessage.Status.FAILED)
        .exclude(status=AssistantMessage.Status.PENDING).order_by("-created_at", "-id")[:HISTORY_MESSAGES + 1]
    )
    earlier.reverse()
    question = earlier.pop() if earlier and earlier[-1].role == AssistantMessage.Role.USER else None
    if question is None:
        reply.status, reply.error = AssistantMessage.Status.FAILED, "no-question"
        reply.save(update_fields=["status", "error", "updated_at"])
        return reply
    history = [(m.role, _anonymize(m.content, name)[:HISTORY_CHARS]) for m in earlier]
    prompt = assistant_prompt(facts, history, _anonymize(question.content, name))
    try:
        result = client.complete(reply.tier, prompt, feature="assistant", user=parent, child=child, temperature=0.6)
        text = clean_reply(result.text).replace(NAME_TOKEN, name or "فرزندتان")
        if len(text) < 2:
            raise client.AIError("empty")
    except client.AIError as error:
        reply.status = AssistantMessage.Status.FAILED
        reply.error = error.code[:200]
        reply.content = "پاسخ نرسید؛ لطفاً دوباره بپرسید. این پرسش از سهمیه‌ی امروز کم نشد."
        reply.save(update_fields=["status", "error", "content", "updated_at"])
        return reply
    reply.content = text
    reply.status = AssistantMessage.Status.DONE
    reply.model = result.model
    reply.save(update_fields=["content", "status", "model", "updated_at"])
    return reply


def clear(parent, child) -> int:
    deleted, _ = AssistantMessage.objects.filter(parent=parent, child=child).exclude(
        status=AssistantMessage.Status.PENDING).delete()
    return deleted
