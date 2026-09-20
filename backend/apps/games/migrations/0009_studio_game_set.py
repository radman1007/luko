"""
مجموعه‌ی تازه‌ی بازی‌های استودیو جای نسخه‌های قبلی را می‌گیرد.

۲۲ بازی از ۲۷ بازیِ قبلی در مجموعه‌ی تازه نسخه‌ی به‌روز دارند — همان بازی،
ساختِ تازه، با نامِ تازه‌ی استودیو. اگر فقط فایل‌ها عوض شوند، همگام‌سازی
آن‌ها را «بازیِ تازه» می‌بیند (نه مسیرشان یکی است نه محتوایشان) و ستاره و
سکه‌ای که بچه‌ها گرفته‌اند به بازیِ تازه نمی‌چسبد. این‌جا ردیفِ هر بازی به
فایلِ تازه‌اش وصل می‌شود تا پیشرفت سرِ جایش بماند.

اثرانگشت خالی می‌شود تا همگام‌سازی فایل را از روی مسیر بشناسد؛ خودش دوباره
پُرش می‌کند. پنج بازیِ بی‌جفت (نامِ نسخه‌ی تازه‌شان خراب است) دست‌نخورده
می‌مانند و چون فایلشان نیست «حذف‌شده» می‌شوند؛ تاریخچه‌شان نگه داشته می‌شود.
"""
from django.db import migrations

#: (فایلِ قبلی، فایلِ تازه) — جفت‌ها از روی عنوانِ خودِ بازی‌ها درآمده‌اند
PAIRS = [
    ("C1-Kn-F1-S1-G4.html", "C1KnF1S1g1.html"),
    ("C1-Kn-F1-S2-G4.html", "C1KnF1S2g7.html"),
    ("C1-Kn-F1-S3-G3.html", "C1KnF1S1g3.html"),
    ("C1-Kn-F1-S4-G3.html", "C1KnF1S1g4.html"),
    ("C1-Kn-F2-S1-G4.html", "C1KnF2S1g2.html"),
    ("C1-Ko-F3-S1-G2.html", "C1KoF3S1g1.html"),
    ("C1-Kq-F1-S1-G5.html", "C1KqF1S1g1.html"),
    ("C1-Kq-F1-S2-G5.html", "C1KqF1S1g2.html"),
    ("C1-Kq-F1-S3-G4.html", "C1KqF1S1g3.html"),
    ("C1-Kq-F1-S4-G4.html", "C1KqF1S1g4.html"),
    ("C1-Kr-F1-S1-G1.html", "C1KrF1S1g1.html"),
    ("C1-Kr-F1-S1-G2.html", "C1KrF1S1g2.html"),
    ("C1-Kr-F1-S1-G3.html", "C1KrF1S1g3.html"),
    ("C1-Kr-F1-S2-G1.html", "C1KrF1S1g4.html"),
    ("C1-Kr-F1-S2-G3.html", "C1KrF1S2g6.html"),
    ("C1-Kr-F1-S3-G1.html", "C1KrF1S2g7.html"),
    ("C1-Kr-F1-S3-G2.html", "C1KrF1S2g8.html"),
    ("C1-Kr-F1-S4-G1.html", "C1KrF1S2g9.html"),
    ("C1-Kr-F1-S4-G2.html", "C1KrF1S2g10.html"),
    ("C1-Kr-F3-S1-G1.html", "C1KrF3S1g1.html"),
    ("C1-Kr-F6-S1-G1.html", "C1KrF6S1g1.html"),
    ("C1-Kr-F6-S1-G2.html", "C1KrF6S1g2.html"),
]


def _move(apps, pairs):
    Game = apps.get_model("games", "Game")
    for source, target in pairs:
        Game.objects.filter(game_file=f"/games/{source}").update(
            game_file=f"/games/{target}", content_hash="")


def forwards(apps, schema_editor):
    _move(apps, PAIRS)


def backwards(apps, schema_editor):
    _move(apps, [(new, old) for old, new in PAIRS])


class Migration(migrations.Migration):

    dependencies = [("games", "0008_legacy_games_to_codes")]

    operations = [migrations.RunPython(forwards, backwards)]
