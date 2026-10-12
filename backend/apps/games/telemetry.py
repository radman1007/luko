"""
دریافتِ رویدادهای بازی — قراردادِ نسخه‌ی ۳ (docs/event-tracking-guide.md).

یک تابع دو شکلِ ورودی را می‌فهمد:

- آیتمِ نسخه‌ی ۳: ستون‌ها صریح‌اند (`event_id`, `session_id`, `concept_tag`, `is_correct`,
  `time_taken_ms`, `attempt_number`, `error_type`, …) و `payload` فقط داده‌ی اضافه است.
- آیتمِ قدیمی (نسخه‌ی ۲، هنوز در صفِ آفلاینِ گوشی‌ها یا SDKِ کش‌شده): همه‌چیز در `payload`
  با کلیدهای camelCase (`correct`, `ms`, `attempt`, `topic`, `at`, `sessionId`, …).

هیچ‌وقت کلِ دسته به‌خاطرِ یک رویدادِ خراب رد نمی‌شود: آیتمِ نامعتبر کنار می‌رود و بقیه
ذخیره می‌شوند. `user` و `game` را بازی نمی‌فرستد؛ کاربر از نشست می‌آید و شناسه‌ی بازی را
صفحه‌ی بازیِ سایت می‌گذارد.
"""
from __future__ import annotations

import json
import re
import uuid
from datetime import datetime, timedelta
from datetime import timezone as dt_timezone

from django.utils import timezone

from .models import ERROR_TYPES, GameEvent

#: سقفِ آیتم در هر درخواست (اپ دسته‌های ۱۰۰تایی می‌فرستد)
MAX_BATCH = 200
#: سقفِ داده‌ی اضافه‌ی هر رویداد؛ خلاصه‌ی بازیِ ۵۰ مرحله‌ای حدودِ ۱۰KB است
MAX_PAYLOAD_BYTES = 16_000
#: ساعتِ گوشی کمی جلو باشد اشکالی ندارد؛ بیشتر از این یعنی ساعتِ غلط
FUTURE_SKEW = timedelta(minutes=5)
#: رویدادِ آفلاینِ قدیمی‌تر از این را با زمانِ رسیدن ثبت می‌کنیم
MAX_AGE = timedelta(days=30)
#: بیش از یک ساعت برای یک پاسخ یعنی بچه رفته بوده، نه فکر می‌کرده
MAX_ANSWER_MS = 60 * 60 * 1000
MAX_DURATION_MS = 6 * 60 * 60 * 1000

TYPE_RE = re.compile(r"^[a-z][a-z0-9_]{1,39}$")
SLUG_RE = re.compile(r"^[-a-zA-Z0-9_]{1,80}$")
TAG_RE = re.compile(r"^[a-z][a-z0-9_-]{0,63}$")
SESSION_RE = re.compile(r"^[A-Za-z0-9_.:-]{1,64}$")

#: رویدادهایی که «مدتِ فعال» دارند: پایانِ جلسه و پایانِ مرحله
DURATION_TYPES = {"game_end", "game_complete", "level_end", "results_finalized"}


def _int(value, low: int, high: int) -> int | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        number = int(round(float(value)))
    except (TypeError, ValueError, OverflowError):
        return None
    return number if low <= number <= high else None


def _bool(value) -> bool | None:
    return value if isinstance(value, bool) else None


def _text(value, pattern: re.Pattern) -> str:
    return value if isinstance(value, str) and pattern.match(value) else ""


def _uuid(value) -> uuid.UUID | None:
    if not isinstance(value, str):
        return None
    try:
        return uuid.UUID(value)
    except ValueError:
        return None


def _when(value, received: datetime) -> datetime:
    """میلی‌ثانیه از ۱۹۷۰ (عدد) یا ISO؛ نامعقول یا خالی → زمانِ رسیدن."""
    at = None
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        try:
            at = datetime.fromtimestamp(value / 1000, tz=dt_timezone.utc)
        except (OverflowError, OSError, ValueError):
            at = None
    elif isinstance(value, str) and value:
        try:
            at = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            at = None
        if at is not None and timezone.is_naive(at):
            at = timezone.make_aware(at, dt_timezone.utc)
    if at is None or at > received + FUTURE_SKEW or at < received - MAX_AGE:
        return received
    return at


def normalize(item, received: datetime) -> dict | None:
    """آیتمِ ورودی → فیلدهای `GameEvent`، یا None اگر قابلِ ذخیره نیست."""
    if not isinstance(item, dict):
        return None
    slug = _text(item.get("game_slug"), SLUG_RE)
    event_type = _text(item.get("event_type"), TYPE_RE)
    if not slug or not event_type:
        return None

    payload = item.get("payload")
    payload = dict(payload) if isinstance(payload, dict) else {}

    def pick(column: str, legacy: str | None = None):
        """ستونِ صریحِ نسخه‌ی ۳، وگرنه کلیدِ قدیمیِ payload"""
        value = item.get(column)
        if value is None and legacy:
            value = payload.get(legacy)
        return value

    is_answer = event_type == "answer"
    tag = pick("concept_tag", "topic")
    error_type = pick("error_type", "errorType")
    duration = None
    if event_type in DURATION_TYPES:
        duration = item.get("duration_ms")
        if duration is None:
            duration = payload.get("activeMs", payload.get("durationMs"))

    size = len(json.dumps(payload, ensure_ascii=False, default=str))
    if size > MAX_PAYLOAD_BYTES:
        payload = {"truncated": True, "bytes": size}

    return {
        "game_slug": slug,
        "event_type": event_type,
        "payload": payload,
        "event_id": _uuid(item.get("event_id")),
        "session_id": _text(pick("session_id", "sessionId"), SESSION_RE),
        "occurred_at": _when(pick("occurred_at", "at"), received),
        "schema_version": _int(item.get("schema_version"), 1, 99) or 2,
        "concept_tag": tag.lower() if isinstance(tag, str) and TAG_RE.match(tag.lower()) else "",
        "level": _int(pick("level", "level"), 0, 10_000),
        "is_correct": _bool(pick("is_correct", "correct")) if is_answer else _bool(item.get("is_correct")),
        "time_taken_ms": _int(pick("time_taken_ms", "ms" if is_answer else None), 0, MAX_ANSWER_MS),
        "attempt_number": _int(pick("attempt_number", "attempt" if is_answer else None), 1, 1000),
        "error_type": error_type if error_type in ERROR_TYPES else "",
        "hint_used": _bool(pick("hint_used", "hintUsed")),
        "duration_ms": _int(duration, 0, MAX_DURATION_MS),
    }


#: ستون‌هایی که از روی رویداد پر می‌شوند (همه به‌جز خودِ payload و شناسه‌ها)
COLUMNS = ("session_id", "occurred_at", "concept_tag", "level", "is_correct", "time_taken_ms",
           "attempt_number", "error_type", "hint_used", "duration_ms")


def fill_columns(event: GameEvent) -> None:
    """
    رویدادی که نه از راهِ `store_events` بلکه مستقیم ساخته شده (شل، اسکریپت، تست) با
    payloadِ قدیمی: ستون‌های خالی‌اش از همان payload پر می‌شوند تا گزارش‌ها ببینندش.
    """
    fields = normalize({"game_slug": event.game_slug, "event_type": event.event_type,
                        "payload": event.payload}, timezone.now())
    if fields is None:
        if event.occurred_at is None:
            event.occurred_at = timezone.now()
        return
    for name in COLUMNS:
        if getattr(event, name) in (None, ""):
            setattr(event, name, fields[name])


def store_events(user, items: list) -> tuple[int, int]:
    """
    ذخیره‌ی یک دسته با یک INSERT. رویدادی که `event_id`ش قبلاً ثبت شده (ارسالِ دوباره
    بعد از قطعیِ شبکه) بی‌صدا نادیده گرفته می‌شود. خروجی: (پذیرفته، ردشده).
    """
    received = timezone.now()
    rows = []
    for item in items:
        fields = normalize(item, received)
        if fields is not None:
            rows.append(GameEvent(user=user, **fields))
    if rows:
        GameEvent.objects.bulk_create(rows, ignore_conflicts=True, batch_size=MAX_BATCH)
    return len(rows), len(items) - len(rows)
