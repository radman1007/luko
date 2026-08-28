"""
دادهٔ محتوا (idempotent): ویدیو، پادکست، قانون جاده، خوراکی، کتاب‌ها و مراحل.
مقادیر برابرِ همان چیزی است که فرانت تا امروز ثابت داشت؛ از اینجا به بعد
ویرایش از پنل ادمین انجام می‌شود.
اجرا:  python manage.py seed_content
"""
import re

from django.core.management.base import BaseCommand

from apps.content.models import Podcast, Recipe, TrafficRule, Video
from apps.games.models import Book, Game

VIDEOS = [
    ('ماجراهای کاپیتان — قسمت جدید', 'کارتون', 12, 1840, 'HiOutlineRocketLaunch'),
    ('آزمایش آتشفشان خونگی', 'علمی', 8, 970, 'HiOutlineBeaker'),
    ('قصه\u200cی شب: ماه و ستاره', 'قصه', 10, 2210, 'HiOutlineMoon'),
    ('آهنگ الفبای شاد', 'موسیقی', 4, 3150, 'HiOutlineMusicalNote'),
    ('چرا آسمون آبیه؟', 'علمی', 6, 1420, 'HiOutlineCloud'),
    ('شبیه\u200cساز فضایی لوکو', 'کارتون', 15, 780, 'HiOutlineSparkles'),
    ('قصه\u200cی خورشید خانم', 'قصه', 9, 1130, 'HiOutlineSun'),
    ('ترانه\u200cی انرژی صبحگاهی', 'موسیقی', 3, 2560, 'HiOutlineBolt'),
]

PODCASTS = [
    ('سفر به فضا', 'علمی', 8, 'HiOutlineRocketLaunch'),
    ('قصه\u200cی جنگل بارونی', 'قصه', 10, 'HiOutlineCloud'),
    ('لالایی ستاره\u200cها', 'خواب', 6, 'HiOutlineMoon'),
    ('آهنگای شاد صبح', 'موسیقی', 5, 'HiOutlineMusicalNote'),
    ('راز دایناسورها', 'علمی', 9, 'HiOutlineBugAnt'),
    ('قصه\u200cی ماهی کوچولو', 'قصه', 7, 'HiOutlineGlobeAsiaAustralia'),
    ('ترانه\u200cی شب\u200cبخیر', 'خواب', 4, 'HiOutlineStar'),
]

TRAFFIC_RULES = [
    ('crosswalk', 'همیشه از خط\u200cکشی عابر پیاده رد شو؛ اون خط\u200cها مال توئه!', False),
    ('look-both', 'قبل از رد شدن: اول چپ، بعد راست، دوباره چپ رو نگاه کن.', False),
    ('traffic-light', 'چراغ قرمز یعنی بایست؛ سبز که شد، با احتیاط برو.', False),
    ('seatbelt', 'توی ماشین همیشه کمربند ببند، حتی برای راه\u200cهای کوتاه.', False),
    ('helmet', 'موقع دوچرخه\u200cسواری حتماً کلاه ایمنی سرت باشه.', False),
    ('no-play-street', 'کنار خیابون بازی نکن؛ توپت هم اگه رفت، خودت نرو!', False),
    ('hold-hands', 'موقع رد شدن از خیابون، دست بزرگ\u200cترها رو بگیر.', False),
    ('no-behind-bus', 'هیچ\u200cوقت از پشت اتوبوس یا ماشین پارک\u200cشده رد نشو.', False),
    ('bright-clothes', 'شب که بیرونی، لباس روشن بپوش تا راننده\u200cها ببیننت.', False),
    ('sidewalk', 'توی پیاده\u200cرو راه برو، نه لبه\u200cی خیابون.', False),
]

RECIPES = [
    ('fruit-salad', 'سالاد میوه\u200cی رنگین\u200cکمون', 'یه کاسه پر از رنگ و شادی که خودت می\u200cتونی بسازی!', ['سیب', 'موز', 'پرتقال', 'عسل'], False),
    ('cheese-sandwich', 'ساندویچ پنیریِ خندان', 'یه ساندویچ سریع و خوشمزه برای وقتی گشنته!', ['نان', 'پنیر', 'گوجه', 'خیار'], False),
    ('banana-milk', 'شیرموزِ جادویی', 'نوشیدنی خنک و پرانرژی که در یک دقیقه آماده می\u200cشه!', ['شیر', 'موز', 'عسل'], False),
    ('veggie-omelet', 'املتِ سبزیجاتِ پهلوان', 'صبحونه\u200cی قوی که تو رو تا ظهر سرحال نگه می\u200cداره!', ['تخم\u200cمرغ', 'گوجه', 'فلفل دلمه'], False),
    ('yogurt-parfait', 'ماستِ خوشگلِ لایه\u200cلایه', 'ماست و میوه و مغزها رو لایه\u200cلایه بچین؛ هم خوشمزه هم خوشگل!', ['ماست', 'توت\u200cفرنگی', 'گردو', 'عسل'], False),
]

# (book_id, عنوان، درس، پایه، عنوانِ دنیا، آیکون، [(عنوانِ مرحله، سکه، فایل)])
BOOKS = [
    ('math-1', 'ریاضی اول', 'ریاضی', 1, 'جزیره\u200cی اعداد', 'HiOutlineCalculator',
     [('جزیره\u200cی حیوانات', 10, '01-riyazi_f1_g1.html'), ('قطار اعداد فضایی', 10, '02-riyazi_f1_g2.html'), ('شمارش در جزیره', 10, '03-riyazi_f1_g3.html'), ('هیولاهای گرسنه', 10, '04-riyazi_f1_g4.html'), ('آزمایشگاه غذا', 10, '05-riyazi_f1_g5.html'), ('سفر ریتم', 10, '06-riyazi_f1_g6.html'), ('خرگوش مهربان', 12, '07-riyazi_f1_g7.html'), ('نوشتنِ اعداد فارسی', 12, '08-riyazi_f1_g8.html'), ('اعداد لوکو', 12, '09-riyazi_f1_g9.html'), ('سفر ریاضی', 12, '10-riyazi_f1_g10.html'), ('جدول شگفت\u200cانگیز', 12, '11-riyazi_f2_g1.html'), ('چوب\u200cکبریت\u200cهای آشپزخانه', 12, '12-riyazi_f2_g2.html'), ('جدول شگفت\u200cانگیز ۲', 12, '13-riyazi_f2_g3.html'), ('مزرعه\u200cی ریاضی', 15, '14-riyazi_f3_g1.html'), ('ماجراجویی تفریق', 15, '15-riyazi_f6_g1.html'), ('بالون\u200cهای پروازی', 15, '16-riyazi_f6_g2.html'), ('ماهی کوچک', 15, '17-riyazi_f11_g1.html')]),
    ('science-1', 'علوم اول', 'علوم', 1, 'آزمایشگاه مخفی', 'HiOutlineBeaker',
     [('کارخانه\u200cی خوراکی\u200cها', 18, '23-olom_f3_g1.html')]),
    ('writing-1', 'نگارش اول', 'نگارش', 1, 'قصر کلمه\u200cها', 'HiOutlinePencil',
     [('کارخانه\u200cی خط\u200cهای صاف', 15, '18-negaresh_f1_g1.html'), ('نقاش کوچولو', 15, '19-negaresh_f1_g2.html'), ('خط خمیده', 15, '20-negaresh_f1_g3.html'), ('قطار نگارش', 18, '21-negaresh_f1_g4.html'), ('ماجراهای حروف', 18, '22-negaresh_f2_g2.html')]),
    ('quran-1', 'قرآن اول', 'قرآن', 1, 'باغ نور', 'HiOutlineBookOpen',
     [('نعمت\u200cیاب', 18, '24-ghoran_f1_g1.html'), ('بسم\u200cالله الرحمن الرحیم', 18, '25-ghoran_f1_g2.html'), ('سلام و علیکم', 18, '26-ghoran_f1_g3.html'), ('نقاشیِ بسم\u200cالله', 18, '27-ghoran_f1_g4.html')]),
]


def _file_order(name: str) -> tuple[int, str]:
    """`07-little-hunter.html` → ۷. فایلِ بدونِ پیشوند ته‌ی صف می‌رود."""
    match = re.match(r"(\d+)", name)
    return (int(match.group(1)) if match else 10**9, name)


def _apply_season_order(files: list[tuple[str, str]]) -> None:
    """
    ترتیبِ مسیرِ سیزن را از نامِ فایل‌ها می‌سازد — همان قاعده‌ای که فرانت
    دارد. سرور بدونِ این نمی‌داند مرحله‌ی قبلیِ هر بازی کدام است و
    نمی‌تواند جلوی گرفتنِ پاداشِ مرحله‌های جلوتر را بگیرد.
    """
    for index, (_, slug) in enumerate(sorted(files, key=lambda item: _file_order(item[0])), start=1):
        Game.objects.filter(slug=slug).update(season_order=index)


class Command(BaseCommand):
    help = "پرکردنِ محتوای پیش‌فرض (ویدیو/پادکست/قانون/خوراکی/کتاب‌ها)"

    def handle(self, *args, **options):
        made = {}

        for sort, (title, category, minutes, views, icon) in enumerate(VIDEOS):
            _, created = Video.objects.update_or_create(
                title=title,
                defaults={"category": category, "duration_minutes": minutes,
                          "views": views, "icon": icon, "sort": sort, "is_active": True},
            )
            made["video"] = made.get("video", 0) + int(created)

        for sort, (title, category, minutes, icon) in enumerate(PODCASTS):
            _, created = Podcast.objects.update_or_create(
                title=title,
                defaults={"category": category, "duration_minutes": minutes,
                          "icon": icon, "sort": sort, "is_active": True},
            )
            made["podcast"] = made.get("podcast", 0) + int(created)

        for sort, (key, text, has_game) in enumerate(TRAFFIC_RULES):
            _, created = TrafficRule.objects.update_or_create(
                rule_key=key,
                defaults={"text": text, "has_game": has_game, "sort": sort, "is_active": True},
            )
            made["traffic"] = made.get("traffic", 0) + int(created)

        for sort, (key, name, intro, ingredients, has_game) in enumerate(RECIPES):
            _, created = Recipe.objects.update_or_create(
                recipe_key=key,
                defaults={"name": name, "intro": intro, "ingredients": ingredients,
                          "has_game": has_game, "sort": sort, "is_active": True},
            )
            made["recipe"] = made.get("recipe", 0) + int(created)

        season_files: list[tuple[str, str]] = []
        for sort, (book_id, title, subject, grade, world, icon, levels) in enumerate(BOOKS):
            Book.objects.update_or_create(
                book_id=book_id,
                defaults={"title": title, "subject": subject, "grade": grade,
                          "world_title": world, "icon": icon, "sort": sort, "is_active": True},
            )
            for order, (level_title, coins, game_file) in enumerate(levels, start=1):
                # slug همان levelId فرانت است: `${bookId}-${order}`
                _, created = Game.objects.update_or_create(
                    slug=f"{book_id}-{order}",
                    defaults={"title": level_title, "book_id": book_id, "order": order,
                              "coin_reward": coins, "is_active": bool(game_file)},
                )
                made["game"] = made.get("game", 0) + int(created)
                if game_file:
                    season_files.append((game_file, f"{book_id}-{order}"))

        _apply_season_order(season_files)

        self.stdout.write(self.style.SUCCESS(
            "محتوا آماده شد — "
            f"ویدیو {Video.objects.count()} · پادکست {Podcast.objects.count()} · "
            f"قانون {TrafficRule.objects.count()} · خوراکی {Recipe.objects.count()} · "
            f"کتاب {Book.objects.count()} · مرحله {Game.objects.count()}"
        ))
