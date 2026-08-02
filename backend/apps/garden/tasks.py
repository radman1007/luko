"""تسک‌های زمان‌بندی‌شده‌ی باغچه (Celery beat)."""
from celery import shared_task

from apps.common import cache

from .models import GardenState
from .services import apply_seasonal_reset


@shared_task(name="apps.garden.tasks.apply_seasonal_resets")
def apply_seasonal_resets():
    """
    روزی یک‌بار: هر باغچه‌ای که فصلش با فصلِ تقویمی فرق دارد ریست و با تمِ فصلِ
    جدید بالا می‌آید. (نمای کاربر هم موقعِ خواندن lazy ریست می‌شود؛ این تسک proactive است.)
    """
    changed = 0
    for state in GardenState.objects.all().iterator():
        if apply_seasonal_reset(state):
            cache.invalidate(cache.garden_key(state.user_id))
            changed += 1
    return {"reset": changed}
