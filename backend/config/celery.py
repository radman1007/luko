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
    # پرداختی که مرورگرش از درگاه برنگشت؛ وندار تا ۲۰ دقیقه تأیید می‌پذیرد
    "billing-reconcile-pending": {
        "task": "apps.billing.tasks.reconcile_pending",
        "schedule": crontab(minute="*/3"),
    },
    # یادآوریِ تمدید از ۷ روز پیش از پایانِ اشتراک
    "billing-notify-expiring-daily": {
        "task": "apps.billing.tasks.notify_expiring",
        "schedule": crontab(hour=9, minute=30),
    },
}
