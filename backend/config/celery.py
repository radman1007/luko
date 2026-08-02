"""اپلیکیشن Celery + زمان‌بندی ریست‌های هفتگی و فصلی."""
import os

from celery import Celery
from celery.schedules import crontab

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

app = Celery("luko")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()

# زمان‌بندی: هر شنبه ۰۰:۰۵ ریستِ نمای هفته‌ی کلاب؛ روزانه ۰۰:۱۰ چک تغییر فصلِ باغچه.
app.conf.beat_schedule = {
    "club-weekly-reset-saturday": {
        "task": "apps.club.tasks.rollover_week",
        "schedule": crontab(hour=0, minute=5, day_of_week="saturday"),
    },
    "garden-seasonal-check-daily": {
        "task": "apps.garden.tasks.apply_seasonal_resets",
        "schedule": crontab(hour=0, minute=10),
    },
}
