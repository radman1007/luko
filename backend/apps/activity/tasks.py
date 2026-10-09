from celery import shared_task

from .services import prune


@shared_task
def prune_activity():
    """ردیف‌های حضورِ قدیمی‌تر از KEEP_DAYS — روزی یک‌بار."""
    return prune()
