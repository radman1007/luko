"""
پرکردنِ داده‌های پیش‌فرض (idempotent) — منطبق با ثابت‌های فرانت:
مأموریت‌ها/ورزش/مدال/فروشگاهِ کلاب + فروشگاهِ باغچه.
اجرا:  python manage.py seed_luko
"""
from django.core.management.base import BaseCommand

from apps.club.models import Medal, MissionTemplate, ShopItem
from apps.garden.models import GardenShopItem

DAILY_MISSIONS = [
    ("یه بازی رو کامل کن", 10, "HiOutlinePuzzlePiece"),
    ("حالت رو به دکتر نیلا بگو", 5, "HiOutlineFaceSmile"),
    ("یه دور نفس جادویی برو", 5, "HiOutlineCloud"),
    ("یه درس از کتابت بخون", 10, "HiOutlineBookOpen"),
]
SPORT_TASKS = [
    ("یه دقیقه درجا بدو", 10, "HiOutlineBolt"),
    ("ده تا پروانه بزن", 10, "HiOutlineSparkles"),
    ("هشت بار بشین‌پاشو", 10, "HiOutlineArrowsUpDown"),
    ("با خانواده پیاده‌روی کن", 15, "HiOutlineMapPin"),
]
CLUB_SHOP = [
    ("sticker", "برچسب قهرمانی", 40, "HiOutlineSparkles"),
    ("paint", "رنگ مخصوص باغچه", 70, "HiOutlinePaintBrush"),
    ("gift", "جعبه‌ی شانس", 100, "HiOutlineGift"),
    ("cup", "کاپ کوچولوی طلایی", 180, "HiOutlineTrophy"),
]
MEDALS = [
    ("first", "اولین قدم", "اولین مأموریتت رو انجام دادی", "HiOutlineStar", "first_task", 1),
    ("streak3", "سه روز آتشین", "۳ روز پشت سر هم تمرین کردی", "HiOutlineFire", "streak", 3),
    ("ten", "ده‌تایی شدی", "۱۰ مأموریت کامل کردی", "HiOutlineRocketLaunch", "total_tasks", 10),
    ("buyer", "خریدار باشگاه", "اولین جایزه‌ت رو خریدی", "HiOutlineShoppingBag", "purchases", 1),
]
GARDEN_SHOP = [
    ("seed-pack", "پاکت دانه", "یک دانه‌ی تازه برای کاشت", 8, "seed", "", 1),
    ("fertilizer", "کیسه کود", "دو واحد کود برای رشد سریع‌تر", 12, "fertilizer", "", 2),
    ("plot", "بزرگ‌تر کردن باغچه", "جای کاشت و ظرفیت آب بیشتر", 30, "plot", "", 1),
    ("decor-butterfly", "پروانه‌ها", "پروانه‌های بازیگوش دور باغچه", 20, "decor", "butterfly", 1),
    ("decor-lantern", "فانوس باغ", "یک فانوس گرم گوشه‌ی باغچه", 24, "decor", "lantern", 1),
    ("decor-pond", "آبنمای کوچک", "یک برکه‌ی زلال کنار گیاه‌ها", 28, "decor", "pond", 1),
]


class Command(BaseCommand):
    help = "پرکردنِ داده‌های پیش‌فرضِ کلاب و باغچه"

    def handle(self, *args, **options):
        for i, (title, coin, icon) in enumerate(DAILY_MISSIONS):
            MissionTemplate.objects.get_or_create(
                title=title, category=MissionTemplate.Category.MISSION,
                defaults={"coin_reward": coin, "icon": icon, "is_fixed": True, "sort": i},
            )
        for i, (title, coin, icon) in enumerate(SPORT_TASKS):
            MissionTemplate.objects.get_or_create(
                title=title, category=MissionTemplate.Category.SPORT,
                defaults={"coin_reward": coin, "icon": icon, "is_fixed": True, "sort": i},
            )
        for i, (key, title, cost, icon) in enumerate(CLUB_SHOP):
            ShopItem.objects.get_or_create(
                item_key=key,
                defaults={"title": title, "cost": cost, "icon": icon, "sort": i},
            )
        for i, (key, title, desc, icon, crit, thr) in enumerate(MEDALS):
            Medal.objects.get_or_create(
                key=key,
                defaults={"title": title, "description": desc, "icon": icon,
                          "criteria": crit, "threshold": thr, "sort": i},
            )
        for i, (key, title, desc, cost, kind, payload, amount) in enumerate(GARDEN_SHOP):
            GardenShopItem.objects.get_or_create(
                item_key=key,
                defaults={"title": title, "description": desc, "cost": cost,
                          "kind": kind, "payload": payload, "amount": amount, "sort": i},
            )
        self.stdout.write(self.style.SUCCESS("داده‌های پیش‌فرض پر شد ✓"))
