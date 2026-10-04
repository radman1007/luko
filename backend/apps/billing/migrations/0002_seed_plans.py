"""دو پلنِ پولیِ اول؛ قیمت و مدت بعداً از پنلِ ادمین عوض می‌شود."""
from django.db import migrations

PLANS = [
    {"code": "monthly", "title": "ماهانه", "duration_days": 30, "price_toman": 299_000, "order": 1},
    {"code": "yearly", "title": "سالانه", "duration_days": 365, "price_toman": 1_049_000, "order": 2},
]


def seed(apps, schema_editor):
    Plan = apps.get_model("billing", "Plan")
    for row in PLANS:
        Plan.objects.update_or_create(code=row["code"], defaults=row)


class Migration(migrations.Migration):
    dependencies = [("billing", "0001_initial")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
