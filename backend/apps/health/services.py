"""منطقِ لوکو سلامت — یادآورِ حالِ دل هر نیم‌ساعت، و ثبتِ حالی که از دستگاهِ بچه می‌رسد."""
from __future__ import annotations

import json
import re
from datetime import date, datetime, time, timedelta, timezone as dt_timezone

from django.db import IntegrityError, transaction
from django.utils import timezone

from .models import MOOD_CHOICES, MOOD_INTERVAL_MINUTES, BreathingSession, MoodCheckin

#: کلیدهای localStorage که اپِ بچه حالِ آخر را در آن‌ها می‌گذارد و هم‌رسان می‌کند (features/health/useMoodReminder.ts)
SYNC_MOOD_KEY = "luko_last_mood"
SYNC_MOOD_TIME_KEY = "luko_last_mood_time"
MOODS = {key for key, _label in MOOD_CHOICES}
#: ساعتِ دستگاهِ بچه ممکن است جلو یا عقب باشد؛ زمانِ دورتر از این‌ها باور نمی‌شود و «اکنون» ثبت می‌شود
CLOCK_AHEAD = timedelta(minutes=5)
CLOCK_BEHIND = timedelta(days=60)
#: مأموریت‌های هر روزِ بچه (features/club/store.ts)؛ «breath» یعنی آن روز دستِ‌کم یک دورِ کاملِ تنفس رفته
SYNC_DAY_DONE_RE = re.compile(r"^luko_club_done_(\d{4}-\d{2}-\d{2})$")
BREATH_MISSION = "breath"


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


def record_breathing(user, cycles: int, seconds: int) -> BreathingSession:
    """
    تمرینی که اپ با تعدادِ دور و مدت می‌فرستد. اگر هم‌رسانی امروز برای همین تمرین ردیفِ بی‌مدت ساخته
    (record_synced_breathing، چون مأموریتِ «نفس جادویی» زودتر هم‌رسان می‌شود) همان کامل می‌شود، نه دوتا.
    """
    today = timezone.localdate()
    with transaction.atomic():
        guessed = (BreathingSession.objects.select_for_update()
                   .filter(user=user, seconds=0, created_at__date=today).order_by("-created_at").first())
        if guessed is None:
            return BreathingSession.objects.create(user=user, cycles=cycles, seconds=seconds)
        guessed.cycles, guessed.seconds = cycles, seconds
        guessed.save(update_fields=["cycles", "seconds", "updated_at"])
        return guessed


def record_synced_breathing(user, keys) -> int:
    """
    بعد از هم‌رسانی: روزی که «breath» در مأموریت‌های انجام‌شده‌ی آن روزِ دستگاه هست ولی هیچ تمرینِ تنفسی برایش
    ثبت نشده، یک تمرین با مدتِ نامعلوم (seconds=0) می‌گیرد. تا ۲۵ مهر ۱۴۰۵ تنفس از هیچ‌جا به سرور نمی‌رسید و اپِ
    اندرویدیِ نصب‌شده هنوز همین را دارد؛ از این راه دستِ‌کم «آن روز تنفس کرد» به پنلِ والد می‌رسد.
    خروجی: تعدادِ تمرینِ ساخته‌شده.
    """
    from apps.sync.models import KidData

    days = {key: match.group(1) for key in keys if (match := SYNC_DAY_DONE_RE.match(key))}
    if not days:
        return 0
    today = timezone.localdate()
    created = 0
    for key, value in KidData.objects.filter(user=user, key__in=days).values_list("key", "value"):
        try:
            done = json.loads(value or "[]")
            day = date.fromisoformat(days[key])
        except ValueError:
            continue
        if not isinstance(done, list) or BREATH_MISSION not in done:
            continue
        # ساعتِ دستگاه ممکن است یک روز جلو باشد؛ روزِ خیلی دور باور نمی‌شود
        if not today - CLOCK_BEHIND <= day <= today + timedelta(days=1):
            continue
        if BreathingSession.objects.filter(user=user, created_at__date=min(day, today)).exists():
            continue
        row = BreathingSession.objects.create(user=user, cycles=1, seconds=0)
        if day < today:
            BreathingSession.objects.filter(pk=row.pk).update(
                created_at=timezone.make_aware(datetime.combine(day, time(12))))
        created += 1
    return created


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
