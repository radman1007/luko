"""
دادهٔ محتوا (idempotent): ویدیو، پادکست، قانون جاده، خوراکی، کتاب‌ها و مراحل.
مقادیر برابرِ همان چیزی است که فرانت تا امروز ثابت داشت؛ از اینجا به بعد
ویرایش از پنل ادمین انجام می‌شود.
اجرا:  python manage.py seed_content
"""
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
     [('جزیره\u200cی حیوانات', 10, '01-animals-island.html'), ('قطار اعداد', 10, '04-number-train.html'), ('شکارچی کوچک', 12, '07-little-hunter.html'), ('هیولاهای گرسنه', 12, '09-hungry-monsters.html'), ('آشپز کوچولو', 12, '10-little-chef.html'), ('سفر ریتم', 14, '11-rhythm-journey.html'), ('خرگوش مهربان', 14, '12-kind-rabbit.html'), ('اعداد فارسی', 15, '13-persian-numbers.html'), ('حدس اعداد فضایی', 15, '14-space-numbers.html'), ('سفر ریاضی', 20, '15-math-journey.html')]),
    ('science-1', 'علوم اول', 'علوم', 1, 'آزمایشگاه مخفی', 'HiOutlineBeaker',
     [('یادگیری سایه', 10, '02-shadow.html'), ('آزمایشگاه گوجه', 12, '05-tomato-lab.html'), ('آزمایشگاه جادویی آب', 15, '08-water-lab.html')]),
    ('writing-1', 'نگارش اول', 'نگارش', 1, 'قصر کلمه\u200cها', 'HiOutlinePencil',
     [('نگارش حرف سین', 12, '03-letter-seen.html'), ('حرفِ اولِ اسمم', 12, ''), ('کلمه\u200cسازی', 14, ''), ('جمله\u200cی خندان', 16, '')]),
    ('quran-1', 'قرآن اول', 'قرآن', 1, 'باغ نور', 'HiOutlineBookOpen',
     [('قطار قرآن؛ سوره\u200cی توحید', 12, '06-quran-train.html'), ('آیه\u200cهای نور', 15, '')]),
]


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

        self.stdout.write(self.style.SUCCESS(
            "محتوا آماده شد — "
            f"ویدیو {Video.objects.count()} · پادکست {Podcast.objects.count()} · "
            f"قانون {TrafficRule.objects.count()} · خوراکی {Recipe.objects.count()} · "
            f"کتاب {Book.objects.count()} · مرحله {Game.objects.count()}"
        ))
