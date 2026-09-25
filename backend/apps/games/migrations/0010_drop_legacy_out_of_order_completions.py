"""
تکمیل‌های جامانده از ترتیبِ قبلیِ مسیر.

تا ۱۹ سپتامبر مسیر کتاب‌به‌کتاب بود (اول بازی‌های ریاضی، بعد بقیه) و سرور
پشتِ‌سرهم بودن را نمی‌سنجید. رجیستریِ نام‌محور کتاب‌ها را درهم کرد و سرور
ترتیب را اجباری کرد. بچه‌ای که چهار بازیِ ریاضی را پشتِ هم رفته بود حالا
مرحله‌های ۱، ۵، ۹ و ۱۳ را «تمام‌شده» دارد و روی مرحله‌ی ۲ ایستاده: پروفایل
«۷ بازیِ تمام‌شده» می‌گفت وقتی نقشه «مرحله‌ی ۶»؛ و با رسیدن به آن‌ها از رویشان
رد می‌شد بی‌آنکه بازیِ آن‌جا را دیده باشد (محتوایشان ۲۰ سپتامبر عوض شد).

فقط این‌ها برداشته می‌شوند: تکمیلی که روی مسیرِ کلاسِ خودِ بچه **جلوتر از
اولین مرحله‌ی نرفته‌اش** است **و** پیش از جابه‌جاییِ مسیر ثبت شده. تکمیلِ بعد از
آن هرگز جلوتر از جای بچه ثبت نشده (سرور نمی‌گذاشت)، مگر با جابه‌جاییِ بعدیِ
فایل‌ها — که واقعی است و می‌ماند. سکه، امتیاز و گنجِ گرفته‌شده دست نمی‌خورد؛
بچه وقتی به آن مرحله برسد بازیِ تازه‌اش را بازی می‌کند.

برگشت‌پذیر نیست (ردیف‌ها پاک می‌شوند)؛ اسکریپتِ استقرار پیش از مهاجرت از
دیتابیس پشتیبان می‌گیرد.
"""
from datetime import datetime, timezone

from django.db import migrations

#: نیمه‌شبِ ۲۰ سپتامبر به وقتِ تهران — بعد از استقرارِ رجیستریِ نام‌محور
CUTOFF = datetime(2026, 9, 19, 20, 30, tzinfo=timezone.utc)


def stray_completions(Game, GameCompletion, user_id: int, grade: int) -> list[int]:
    """شناسه‌ی ردیف‌هایی که باید بروند (برای تست هم به‌کار می‌رود)."""
    path = list(
        Game.objects.filter(status="ready", is_active=True, grade=grade, season_order__gt=0)
        .order_by("season_order", "id")
        .values_list("slug", flat=True)
    )
    rows = {c.game_slug: c for c in GameCompletion.objects.filter(user_id=user_id)}
    first_gap = next((i for i, slug in enumerate(path) if slug not in rows), None)
    if first_gap is None:
        return []
    return [
        rows[slug].pk
        for slug in path[first_gap + 1:]
        if slug in rows and rows[slug].created_at < CUTOFF
    ]


def forwards(apps, schema_editor):
    Game = apps.get_model("games", "Game")
    GameCompletion = apps.get_model("games", "GameCompletion")
    User = apps.get_model("accounts", "User")

    doomed: list[int] = []
    kids = User.objects.filter(role="student", game_completions__isnull=False).distinct()
    for kid in kids.only("pk", "grade"):
        doomed += stray_completions(Game, GameCompletion, kid.pk, kid.grade)
    if doomed:
        GameCompletion.objects.filter(pk__in=doomed).delete()
        print(f"\n  {len(doomed)} تکمیلِ جامانده از ترتیبِ قبلیِ مسیر برداشته شد")


class Migration(migrations.Migration):
    dependencies = [
        ("games", "0009_studio_game_set"),
        ("accounts", "0005_alter_kidsettings_options_alter_lukorian_options_and_more"),
    ]

    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
