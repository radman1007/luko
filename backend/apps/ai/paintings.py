"""
نقاشی‌های بچه در پنلِ والد، و برداشتِ دستیار از هر نقاشی به درخواستِ والد.

- تصویر شخصی است: فقط والدِ همین بچه از راهِ APIِ احرازشده می‌بیندش (مثلِ گالریِ خودِ بچه، apps.health).
- دیدنِ نقاشی‌ها برای همه است؛ تحلیل فقط با اشتراکِ همان فرزند (هزینه‌ی مدل).
- هر نقاشی یک تحلیل دارد که نگه داشته می‌شود؛ درخواستِ دوباره همان را نشان می‌دهد، ناموفق دوباره ساخته می‌شود.
- مدل Luna است چون تصویر را می‌بیند (آزمونِ ۲۵ مهر ۱۴۰۵ روی سرور؛ Pro تصویر را نمی‌بیند). نامِ بچه به مدل نمی‌رود.
"""
from __future__ import annotations

import re
from datetime import timedelta

from django.utils import timezone

from apps.common.fa import fa_when
from apps.health.models import Painting
from apps.parent.wellbeing import COLOR_FA

from . import client
from .assistant import AssistantError, is_premium
from .facts import GRADE_FA, MOOD_FA
from .models import PaintingAnalysis
from .prompts import painting_prompt
from .validate import clean_reply

SHOWN = 60
TIER = "luna"
#: تحلیلی که این‌قدر در صف مانده دیگر نمی‌رسد
STALE_AFTER = timedelta(minutes=4)
FAILED_TEXT = "تحلیل آماده نشد؛ چند لحظه بعد دوباره امتحان کنید."
#: دو سرتیترِ پاسخ (prompts.PAINTING_RULES)؛ پاک‌سازی ستاره‌ها را برمی‌دارد و این‌جا دوباره پررنگ می‌شوند
LABELS = ("آنچه در نقاشی دیده می‌شود", "رنگ‌ها و حس")


def find(child, painting_id) -> Painting | None:
    return Painting.objects.filter(user=child, pk=painting_id).select_related("analysis").first()


def _expire(analysis: PaintingAnalysis) -> None:
    if analysis.status == PaintingAnalysis.Status.PENDING and analysis.updated_at < timezone.now() - STALE_AFTER:
        analysis.status = PaintingAnalysis.Status.FAILED
        analysis.error = "timeout"
        analysis.content = FAILED_TEXT
        analysis.save(update_fields=["status", "error", "content", "updated_at"])


def _analysis(painting: Painting, full: bool) -> dict | None:
    analysis = getattr(painting, "analysis", None)
    if analysis is None:
        return None
    _expire(analysis)
    row = {"status": analysis.status}
    if full:
        row["content"] = "" if analysis.status == PaintingAnalysis.Status.PENDING else analysis.content
        row["atFa"] = fa_when(timezone.localtime(analysis.updated_at), timezone.localdate())
    return row


def _colors(painting: Painting) -> list[dict]:
    counts = painting.colors if isinstance(painting.colors, dict) else {}
    rows = [{"color": key, "label": COLOR_FA.get(str(key).lower(), ""), "count": int(n)}
            for key, n in counts.items() if isinstance(n, (int, float)) and n > 0]
    return sorted(rows, key=lambda r: -r["count"])


def _row(painting: Painting, full: bool = False) -> dict:
    return {
        "id": painting.id,
        "title": painting.title,
        "mood": painting.mood,
        "moodLabel": MOOD_FA.get(painting.mood, ""),
        "thumbnail": painting.thumbnail,
        "when": fa_when(timezone.localtime(painting.created_at), timezone.localdate()),
        "colors": _colors(painting),
        "analysis": _analysis(painting, full),
    }


def gallery(child) -> dict:
    rows = child.paintings.defer("image").select_related("analysis").order_by("-created_at")[:SHOWN]
    return {"premium": is_premium(child), "enabled": client.enabled(), "items": [_row(p) for p in rows]}


def detail(child, painting: Painting) -> dict:
    return {**_row(painting, full=True), "image": painting.image, "premium": is_premium(child),
            "enabled": client.enabled()}


def request_analysis(parent, child, painting: Painting) -> PaintingAnalysis:
    if not client.enabled():
        raise AssistantError("disabled", "تحلیلِ نقاشی فعلاً در دسترس نیست.", 503)
    if not is_premium(child):
        raise AssistantError("locked", "تحلیلِ نقاشی با اشتراکِ همین فرزند باز می‌شود.", 403)
    if not painting.image:
        raise AssistantError("no-image", "تصویرِ این نقاشی ذخیره نشده است.", 400)
    analysis = getattr(painting, "analysis", None)
    if analysis is not None:
        _expire(analysis)
        if analysis.status in (PaintingAnalysis.Status.DONE, PaintingAnalysis.Status.PENDING):
            return analysis
        analysis.status, analysis.error, analysis.content, analysis.parent = \
            PaintingAnalysis.Status.PENDING, "", "", parent
        analysis.save(update_fields=["status", "error", "content", "parent", "updated_at"])
    else:
        analysis = PaintingAnalysis.objects.create(painting=painting, parent=parent, tier=TIER,
                                                   model=client.model_of(TIER))
        painting.analysis = analysis
    from .tasks import analyze_painting

    try:
        analyze_painting.delay(analysis.pk)
    except Exception:  # noqa: BLE001
        _fail(analysis, "queue")
    return analysis


def _fail(analysis: PaintingAnalysis, code: str) -> None:
    analysis.status = PaintingAnalysis.Status.FAILED
    analysis.error = code[:200]
    analysis.content = FAILED_TEXT
    analysis.save(update_fields=["status", "error", "content", "updated_at"])


def _tidy(text: str) -> str:
    """پاک‌سازی + سرتیترهای پررنگ. آزمونِ ۲۵ مهر: Luna یک‌بار «۷ stroke» نوشت"""
    text = re.sub(r"(?i)\bstrokes?\b", "خط", clean_reply(text))
    return _bold_labels(text)


def _bold_labels(text: str) -> str:
    """«آنچه در نقاشی دیده می‌شود: …» → «**آنچه در نقاشی دیده می‌شود:** …»"""
    for label in LABELS:
        text = re.sub(rf"(?m)^\s*{re.escape(label)}\s*[:：]\s*", f"**{label}:** ", text)
    return text


def analyze(analysis_id: int) -> PaintingAnalysis | None:
    """کارِ صف: برداشت از یک نقاشی"""
    analysis = PaintingAnalysis.objects.select_related("painting", "painting__user", "parent").filter(
        pk=analysis_id, status=PaintingAnalysis.Status.PENDING).first()
    if analysis is None:
        return None
    painting = analysis.painting
    child = painting.user
    facts = {
        "grade": f"{GRADE_FA.get(child.grade, '')} دبستان".strip(),
        "title_given_by_child": painting.title or None,
        "mood_logged": MOOD_FA.get(painting.mood) or "not logged",
        "colors": {row["label"] or row["color"]: row["count"] for row in _colors(painting)},
    }
    try:
        result = client.complete(analysis.tier, painting_prompt(facts), feature="painting", user=analysis.parent,
                                 child=child, temperature=0.5, image=painting.image)
        text = _tidy(result.text)
        if len(text) < 20:
            raise client.AIError("empty")
    except client.AIError as error:
        _fail(analysis, error.code)
        return analysis
    analysis.content = text
    analysis.status = PaintingAnalysis.Status.DONE
    analysis.model = result.model
    analysis.save(update_fields=["content", "status", "model", "updated_at"])
    return analysis
