import json
import re
from datetime import date, datetime, time, timedelta

from django.db import migrations
from django.utils import timezone

DAY_DONE = re.compile(r"^luko_club_done_(\d{4}-\d{2}-\d{2})$")


def backfill(apps, schema_editor):
    """
    روزهایی که بچه «نفس جادویی» رفته و فقط در داده‌ی هم‌رسان (luko_club_done_<روز>) مانده بود — تنفس تا امروز
    از هیچ‌جا به سرور نمی‌رسید. همان قاعده‌ی apps.health.services.record_synced_breathing، با مدلِ تاریخیِ مایگریشن.
    """
    KidData = apps.get_model("sync", "KidData")
    BreathingSession = apps.get_model("health", "BreathingSession")
    today = timezone.localdate()
    for user_id, key, value in KidData.objects.filter(key__startswith="luko_club_done_") \
            .values_list("user_id", "key", "value"):
        match = DAY_DONE.match(key)
        if not match:
            continue
        try:
            done = json.loads(value or "[]")
            day = date.fromisoformat(match.group(1))
        except ValueError:
            continue
        if not isinstance(done, list) or "breath" not in done:
            continue
        if not today - timedelta(days=60) <= day <= today + timedelta(days=1):
            continue
        day = min(day, today)
        if BreathingSession.objects.filter(user_id=user_id, created_at__date=day).exists():
            continue
        row = BreathingSession.objects.create(user_id=user_id, cycles=1, seconds=0)
        if day < today:
            BreathingSession.objects.filter(pk=row.pk).update(
                created_at=timezone.make_aware(datetime.combine(day, time(12))))


class Migration(migrations.Migration):

    dependencies = [
        ('health', '0005_mood_client_at'),
        ('sync', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(backfill, migrations.RunPython.noop),
    ]
