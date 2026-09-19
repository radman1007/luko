"""
۲۷ بازیِ پیش از رجیستری → نام‌گذاریِ C-K-F-S-G.

نام‌های قدیم (`01-riyazi_f1_g1.html`) فصل (f) و شماره‌ی درونِ کتاب (g) داشتند
ولی هفته نداشتند، و ترتیبشان کتاب‌به‌کتاب بود. این‌جا:

  - F همان f ِ نامِ قدیم است؛
  - فصلِ ۱ (۱۸ بازی) چهار هفته شد تا هر هفته از هر کتابِ همان فصل بازی
    داشته باشد؛ ترتیبِ هر کتاب همان ترتیبِ قبلی است؛
  - G شماره‌ی بازی در هفته است (بینِ همه‌ی کتاب‌ها یکتا).

slugِ قدیم (`math-1-3`) اسمِ درس را در آدرس و در دادهٔ صفحه‌ی بچه می‌گذاشت؛
شناسه‌ی تازه بی‌معناست و پایدار. تکمیل‌ها، رویدادها و بازیِ روزِ والدها به
شناسه‌ی تازه منتقل می‌شوند تا پیشرفتِ هیچ بچه‌ای از دست نرود.

فایل‌ها در همین کامیت با همین نام‌ها به `public/games/` منتقل شده‌اند. ردیف‌ها
این‌جا کامل (با جایگاه) ساخته می‌شوند، پس حتی پیش از اولین `sync_games` هم
مسیر درست است؛ همگام‌سازی فقط اثرانگشتِ فایل‌ها را اضافه می‌کند.
"""
import hashlib

from django.db import migrations

# (slugِ قدیم، فایلِ قدیم زیرِ /games/grade-1/، نامِ تازه زیرِ /games/)
LEGACY = [
    ("math-1-1", "math/01-riyazi_f1_g1.html", "C1-Kr-F1-S1-G1.html"),
    ("math-1-2", "math/02-riyazi_f1_g2.html", "C1-Kr-F1-S1-G2.html"),
    ("math-1-3", "math/03-riyazi_f1_g3.html", "C1-Kr-F1-S1-G3.html"),
    ("writing-1-1", "writing/18-negaresh_f1_g1.html", "C1-Kn-F1-S1-G4.html"),
    ("quran-1-1", "quran/24-ghoran_f1_g1.html", "C1-Kq-F1-S1-G5.html"),
    ("math-1-4", "math/04-riyazi_f1_g4.html", "C1-Kr-F1-S2-G1.html"),
    ("math-1-5", "math/05-riyazi_f1_g5.html", "C1-Kr-F1-S2-G2.html"),
    ("math-1-6", "math/06-riyazi_f1_g6.html", "C1-Kr-F1-S2-G3.html"),
    ("writing-1-2", "writing/19-negaresh_f1_g2.html", "C1-Kn-F1-S2-G4.html"),
    ("quran-1-2", "quran/25-ghoran_f1_g2.html", "C1-Kq-F1-S2-G5.html"),
    ("math-1-7", "math/07-riyazi_f1_g7.html", "C1-Kr-F1-S3-G1.html"),
    ("math-1-8", "math/08-riyazi_f1_g8.html", "C1-Kr-F1-S3-G2.html"),
    ("writing-1-3", "writing/20-negaresh_f1_g3.html", "C1-Kn-F1-S3-G3.html"),
    ("quran-1-3", "quran/26-ghoran_f1_g3.html", "C1-Kq-F1-S3-G4.html"),
    ("math-1-9", "math/09-riyazi_f1_g9.html", "C1-Kr-F1-S4-G1.html"),
    ("math-1-10", "math/10-riyazi_f1_g10.html", "C1-Kr-F1-S4-G2.html"),
    ("writing-1-4", "writing/21-negaresh_f1_g4.html", "C1-Kn-F1-S4-G3.html"),
    ("quran-1-4", "quran/27-ghoran_f1_g4.html", "C1-Kq-F1-S4-G4.html"),
    ("math-1-11", "math/11-riyazi_f2_g1.html", "C1-Kr-F2-S1-G1.html"),
    ("math-1-12", "math/12-riyazi_f2_g2.html", "C1-Kr-F2-S1-G2.html"),
    ("math-1-13", "math/13-riyazi_f2_g3.html", "C1-Kr-F2-S1-G3.html"),
    ("writing-1-5", "writing/22-negaresh_f2_g2.html", "C1-Kn-F2-S1-G4.html"),
    ("math-1-14", "math/14-riyazi_f3_g1.html", "C1-Kr-F3-S1-G1.html"),
    ("science-1-1", "science/23-olom_f3_g1.html", "C1-Ko-F3-S1-G2.html"),
    ("math-1-15", "math/15-riyazi_f6_g1.html", "C1-Kr-F6-S1-G1.html"),
    ("math-1-16", "math/16-riyazi_f6_g2.html", "C1-Kr-F6-S1-G2.html"),
    ("math-1-17", "math/17-riyazi_f11_g1.html", "C1-Kr-F11-S1-G1.html"),
]


def new_slug(old: str) -> str:
    """شناسه‌ی تازه — قطعی، تا روی هر دیتابیسی (محلی، سرور) یکی باشد."""
    return "g-" + hashlib.sha1(f"luko-legacy:{old}".encode()).hexdigest()[:8]


def _code(name: str) -> dict:
    c, k, f, s, g = name[: -len(".html")].split("-")
    return {"grade": int(c[1:]), "book_code": k[1:], "chapter": int(f[1:]),
            "week": int(s[1:]), "number": int(g[1:])}


def _rename_history(apps, pairs: list[tuple[str, str]]) -> None:
    GameCompletion = apps.get_model("games", "GameCompletion")
    GameEvent = apps.get_model("games", "GameEvent")
    DailyAssignment = apps.get_model("parent", "DailyAssignment")
    for old, new in pairs:
        GameCompletion.objects.filter(game_slug=old).update(game_slug=new)
        GameEvent.objects.filter(game_slug=old).update(game_slug=new)
        DailyAssignment.objects.filter(game_slug=old).update(game_slug=new)


def forwards(apps, schema_editor):
    Game = apps.get_model("games", "Game")
    rows = {g.slug: g for g in Game.objects.filter(slug__in=[old for old, _, _ in LEGACY])}
    if not rows:
        return      # دیتابیسِ تازه — چیزی برای انتقال نیست

    placed = sorted(LEGACY, key=lambda item: tuple(_code(item[2])[k]
                    for k in ("grade", "chapter", "week", "number")))
    book_order: dict[str, int] = {}
    for season_order, (old, _, name) in enumerate(placed, start=1):
        game = rows.get(old)
        if game is None:
            continue
        book_order[game.book_id] = book_order.get(game.book_id, 0) + 1
        for field, value in _code(name).items():
            setattr(game, field, value)
        game.slug = new_slug(old)
        game.game_file = f"/games/{name}"
        game.content_hash = ""          # sync_games با مسیر می‌شناسدش و پُرش می‌کند
        game.status = "ready"
        game.review_note = ""
        game.season_order = season_order
        game.order = book_order[game.book_id]
        game.save()

    _rename_history(apps, [(old, new_slug(old)) for old in rows])


def backwards(apps, schema_editor):
    Game = apps.get_model("games", "Game")
    for position, (old, old_file, _) in enumerate(
        sorted(LEGACY, key=lambda item: item[1].split("/")[1]), start=1
    ):
        game = Game.objects.filter(slug=new_slug(old)).first()
        if game is None:
            continue
        game.slug = old
        game.game_file = f"/games/grade-1/{old_file}"
        game.season_order = position
        game.order = int(old.rsplit("-", 1)[1])
        game.save()
    _rename_history(apps, [(new_slug(old), old) for old, _, _ in LEGACY])


class Migration(migrations.Migration):

    dependencies = [
        ("games", "0007_registry_fields"),
        ("parent", "0004_alter_dailyassignment_options_and_more"),
    ]

    operations = [migrations.RunPython(forwards, backwards)]
