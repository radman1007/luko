"""منطقِ لوکو سلامت — یادآورِ حالِ دل هر نیم‌ساعت."""
from __future__ import annotations

from django.utils import timezone

from .models import MOOD_INTERVAL_MINUTES, MoodCheckin


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
