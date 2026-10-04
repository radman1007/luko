"""قیمتِ تازه‌ی پلن‌ها (۴ اکتبر ۲۰۲۶): ماهانه ۱۹۹٬۰۰۰ و سالانه ۱٬۴۹۹٬۰۰۰ تومان.

پرداخت‌های قبلی دست نمی‌خورند؛ مبلغِ هر پرداخت هنگامِ ساختنش در خودش ثبت شده است.
"""
from django.db import migrations

PRICES = {"monthly": 199_000, "yearly": 1_499_000}
PREVIOUS = {"monthly": 299_000, "yearly": 1_049_000}


def _apply(prices):
    def run(apps, schema_editor):
        Plan = apps.get_model("billing", "Plan")
        for code, price in prices.items():
            Plan.objects.filter(code=code).update(price_toman=price)
    return run


class Migration(migrations.Migration):
    dependencies = [("billing", "0002_seed_plans")]
    operations = [migrations.RunPython(_apply(PRICES), _apply(PREVIOUS))]
