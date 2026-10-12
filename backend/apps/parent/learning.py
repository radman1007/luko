"""
یادگیری بر پایه‌ی تگ‌های آموزشی — همان سه عددی که پنلِ والدین می‌خواهد، با کوئری‌های
تجمیعیِ ساده روی ستون‌های GameEvent (docs/event-tracking-guide.md):

۱. مجموعِ زمانِ بازیِ این هفته — زمانِ فعال (بی‌مکث)، هر جلسه فقط یک‌بار.
۲. خطاهای هر تگِ آموزشی، با نوعِ خطا.
۳. درصدِ موفقیت در اولین تلاش.
"""
from __future__ import annotations

from datetime import datetime, timedelta

from django.db.models import Avg, Count, Max, Q, Sum
from django.utils import timezone

from apps.games.models import ERROR_TYPES, ConceptTag, GameEvent

SESSION_ENDS = ("game_end", "game_complete")


def _pct(part: int, total: int) -> int:
    return round(part / total * 100) if total else 0


def concept_tags() -> dict[str, ConceptTag]:
    """تگ‌های فعال؛ تگی که بازی فرستاده ولی تیمِ طراحی ثبتش نکرده به والد نشان داده نمی‌شود"""
    return {tag.code: tag for tag in ConceptTag.objects.filter(is_active=True)}


def play_ms(child, start: datetime, end: datetime) -> int:
    """
    زمانِ فعالِ بازی در بازه. SDK با هر پنهان‌شدنِ صفحه (عوض‌کردنِ تب، خاموش‌شدنِ صفحه)
    خلاصه‌ی *تجمعیِ* همان جلسه را دوباره می‌فرستد؛ جمعِ همه‌شان یک جلسه‌ی ده‌دقیقه‌ای را
    چهل دقیقه نشان می‌داد. پس از هر جلسه فقط بیشینه شمرده می‌شود.
    """
    ends = GameEvent.objects.filter(
        user=child, event_type__in=SESSION_ENDS, duration_ms__isnull=False,
        occurred_at__gte=start, occurred_at__lt=end,
    )
    per_session = ends.exclude(session_id="").values("session_id").annotate(ms=Max("duration_ms"))
    total = sum(row["ms"] for row in per_session)
    # رویدادهای قدیمیِ بی‌جلسه (پلِ پایان) هرکدام یک جلسه‌اند
    total += ends.filter(session_id="").aggregate(ms=Sum("duration_ms"))["ms"] or 0
    return total


def _answers(child, start: datetime, end: datetime):
    return GameEvent.objects.filter(user=child, event_type="answer", occurred_at__gte=start, occurred_at__lt=end)


def first_try(child, start: datetime, end: datetime) -> dict:
    """فقط پاسخ‌هایی که شماره‌ی تلاششان معلوم است؛ بازیِ بی‌شماره‌ی تلاش عدد را خراب نکند"""
    row = _answers(child, start, end).filter(attempt_number=1).aggregate(
        asked=Count("id"), correct=Count("id", filter=Q(is_correct=True)),
    )
    return {"asked": row["asked"], "correct": row["correct"], "rate": _pct(row["correct"], row["asked"])}


def concepts(child, start: datetime, end: datetime, tags: dict[str, ConceptTag]) -> list[dict]:
    """آمارِ هر تگِ آموزشی؛ پرخطاترین‌ها اول"""
    answers = _answers(child, start, end).exclude(concept_tag="")
    rows = answers.values("concept_tag").annotate(
        answers=Count("id"),
        correct=Count("id", filter=Q(is_correct=True)),
        errors=Count("id", filter=Q(is_correct=False)),
        first_asked=Count("id", filter=Q(attempt_number=1)),
        first_correct=Count("id", filter=Q(attempt_number=1, is_correct=True)),
        avg_ms=Avg("time_taken_ms"),
    )
    hints = dict(
        GameEvent.objects.filter(user=child, event_type="hint", occurred_at__gte=start, occurred_at__lt=end)
        .exclude(concept_tag="").values_list("concept_tag").annotate(n=Count("id"))
    )
    kinds: dict[str, list[dict]] = {}
    for row in (answers.filter(is_correct=False).exclude(error_type="")
                .values("concept_tag", "error_type").annotate(n=Count("id")).order_by("-n")):
        kinds.setdefault(row["concept_tag"], []).append(
            {"key": row["error_type"], "label": ERROR_TYPES[row["error_type"]], "count": row["n"]})

    out = []
    for row in rows:
        tag = tags.get(row["concept_tag"])
        if tag is None:
            continue
        out.append({
            "tag": tag.code,
            "label": tag.title,
            "subject": tag.subject,
            "answers": row["answers"],
            "errors": row["errors"],
            "accuracy": _pct(row["correct"], row["answers"]),
            "firstTryAsked": row["first_asked"],
            "firstTryRate": _pct(row["first_correct"], row["first_asked"]),
            "avgSeconds": round((row["avg_ms"] or 0) / 1000, 1),
            "hints": hints.get(tag.code, 0),
            "errorTypes": kinds.get(tag.code, []),
        })
    return sorted(out, key=lambda item: (-item["errors"], -item["answers"], item["label"]))


def build_learning(child, now: datetime | None = None) -> dict:
    """بخشِ «یادگیری» گزارشِ والد: هفت روزِ اخیر، و مفهوم‌ها در هشت هفته"""
    now = now or timezone.now()
    week_start = now - timedelta(days=7)
    prev_start = week_start - timedelta(days=7)
    window_start = now - timedelta(weeks=8)
    tags = concept_tags()

    week_answers = _answers(child, week_start, now).aggregate(
        asked=Count("id"), errors=Count("id", filter=Q(is_correct=False)),
    )
    return {
        "week": {
            "minutes": round(play_ms(child, week_start, now) / 60000),
            "prevMinutes": round(play_ms(child, prev_start, week_start) / 60000),
            "answers": week_answers["asked"],
            "errors": week_answers["errors"],
            "firstTry": first_try(child, week_start, now),
        },
        "firstTry": first_try(child, window_start, now),
        "concepts": concepts(child, window_start, now, tags),
    }
