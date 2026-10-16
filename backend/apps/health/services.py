"""منطقِ لوکو سلامت — یادآورِ حالِ دل هر نیم‌ساعت، و ثبتِ حالی که از دستگاهِ بچه می‌رسد."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone as dt_timezone

from django.db import IntegrityError, transaction
from django.utils import timezone

from .models import MOOD_CHOICES, MOOD_INTERVAL_MINUTES, MoodCheckin

#: کلیدهای localStorage که اپِ بچه حالِ آخر را در آن‌ها می‌گذارد و هم‌رسان می‌کند (features/health/useMoodReminder.ts)
SYNC_MOOD_KEY = "luko_last_mood"
SYNC_MOOD_TIME_KEY = "luko_last_mood_time"
MOODS = {key for key, _label in MOOD_CHOICES}
#: ساعتِ دستگاهِ بچه ممکن است جلو یا عقب باشد؛ زمانِ دورتر از این‌ها باور نمی‌شود و «اکنون» ثبت می‌شود
CLOCK_AHEAD = timedelta(minutes=5)
CLOCK_BEHIND = timedelta(days=60)


def record_device_mood(user, mood: str, client_at, *, now: datetime | None = None) -> MoodCheckin | None:
    """
    یک حالِ ثبت‌شده روی دستگاهِ بچه. `client_at` زمانِ همان دستگاه (میلی‌ثانیه) است و شناسه‌ی این حال:
    اگر همین حال قبلاً رسیده (مستقیم یا از راهِ هم‌رسانی)، چیزی ساخته نمی‌شود و None برمی‌گردد.
    """
    mood = (mood or "").strip()
    if mood not in MOODS:
        return None
    now = now or timezone.now()
    try:
        stamp = int(str(client_at).strip())
    except (TypeError, ValueError):
        stamp = None
    when = now
    if stamp is not None:
        if MoodCheckin.objects.filter(user=user, client_at=stamp).exists():
            return None
        try:
            device_time = datetime.fromtimestamp(stamp / 1000, tz=dt_timezone.utc)
        except (OverflowError, OSError, ValueError):
            device_time = None
        if device_time and now - CLOCK_BEHIND <= device_time <= now + CLOCK_AHEAD:
            when = min(device_time, now)
    try:
        with transaction.atomic():
            checkin = MoodCheckin.objects.create(user=user, mood=mood, client_at=stamp)
    except IntegrityError:
        # همین حال هم‌زمان از راهِ دیگر رسید
        return None
    if when != checkin.created_at:
        MoodCheckin.objects.filter(pk=checkin.pk).update(created_at=when)
        checkin.created_at = when
    return checkin


def record_synced_mood(user) -> MoodCheckin | None:
    """
    بعد از هم‌رسانی: حالِ آخرِ دستگاه (دو کلیدِ luko_last_mood*) را به ثبتِ حال تبدیل می‌کند. اپِ اندرویدیِ نصب‌شده
    حال را فقط در همین کلیدها می‌گذارد؛ بی‌این، حالِ بچه هرگز به پنلِ والد نمی‌رسید.
    """
    from apps.sync.models import KidData

    values = dict(KidData.objects.filter(user=user, key__in=[SYNC_MOOD_KEY, SYNC_MOOD_TIME_KEY])
                  .values_list("key", "value"))
    if not values.get(SYNC_MOOD_KEY) or not values.get(SYNC_MOOD_TIME_KEY):
        return None
    return record_device_mood(user, values[SYNC_MOOD_KEY], values[SYNC_MOOD_TIME_KEY])


def mood_prompt(user) -> dict:
    """
    آیا الان باید حال بپرسیم؟ اگر یادآور روشن است و از آخرین ثبت بیش از نیم‌ساعت
    گذشته (یا هرگز ثبت نشده) → بله.
    """
    reminder_on = user.settings.mood_reminder
    last = user.mood_checkins.first()  # ordering: جدیدترین
    now = timezone.now()

    if last is None:
        minutes_since = None
        should_ask = reminder_on
    else:
        minutes_since = int((now - last.created_at).total_seconds() // 60)
        should_ask = reminder_on and minutes_since >= MOOD_INTERVAL_MINUTES

    return {
        "shouldAsk": should_ask,
        "intervalMinutes": MOOD_INTERVAL_MINUTES,
        "minutesSince": minutes_since,
        "lastMood": last.mood if last else None,
    }
