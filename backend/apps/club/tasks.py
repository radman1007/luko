"""تسک‌های زمان‌بندی‌شده‌ی کلاب."""
from celery import shared_task

from apps.common import cache

from .models import MissionCompletion


@shared_task(name="apps.club.tasks.rollover_week")
def rollover_week():
    """
    هر شنبه ۰۰:۰۵ — ورود به هفته‌ی جدید.
    نمای «این هفته» تاریخ‌محور است و خودش هر شنبه تازه می‌شود؛ این تسک فقط
    cacheِ خلاصه‌ی کلابِ کاربرانِ فعال را باطل می‌کند تا فوراً هفته‌ی نو دیده شود.
    """
    from datetime import timedelta

    from django.utils import timezone

    recent = (
        MissionCompletion.objects.filter(
            created_at__gte=timezone.now() - timedelta(days=14)
        )
        .values_list("user_id", flat=True)
        .distinct()
    )
    day = timezone.localdate().isoformat()
    cache.invalidate(*[cache.user_key(uid, f"club:summary:{day}") for uid in recent])
    return {"invalidated": len(set(recent))}
