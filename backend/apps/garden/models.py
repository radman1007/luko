from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.common.models import TimeStampedModel

from .constants import PLANT_KINDS


class GardenState(TimeStampedModel):
    """کلِ باغچه‌ی یک کاربر — شبنم، آب، کود، دانه، ارتقا، تزئین و فصلِ جاری."""

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                                related_name="garden")
    dew = models.PositiveIntegerField(default=20)                # شبنم (ارز ویژه)
    fertilizer = models.PositiveIntegerField(default=1)          # کود
    seeds = models.PositiveIntegerField(default=2)               # دانه
    plot_level = models.PositiveSmallIntegerField(default=1)     # سطحِ باغچه
    decor = models.JSONField(default=list, blank=True)           # تزئین‌های خریداری‌شده
    water_charges = models.PositiveSmallIntegerField(default=5)  # شارژِ آبِ آب‌پاش
    last_refill_at = models.DateTimeField(default=timezone.now)
    last_watered_at = models.DateTimeField(null=True, blank=True)
    season = models.CharField(max_length=10, default="autumn")   # فصلِ جاری
    season_start_at = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return f"Garden<{self.user}> dew={self.dew}"


class Plant(TimeStampedModel):
    """یک گیاهِ کاشته‌شده در باغچه. مرحله‌ی رشد از care حساب می‌شود."""

    garden = models.ForeignKey(GardenState, on_delete=models.CASCADE, related_name="plants")
    kind = models.CharField(max_length=20, choices=[(k, k) for k in PLANT_KINDS])
    care = models.PositiveIntegerField(default=0)                # امتیازِ مراقبت
    planted_at = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return f"{self.kind}({self.care})"


class DewLogEntry(TimeStampedModel):
    """دفترچه‌ی شبنم — آخرین دریافت‌ها با منبعشان (نمایش + تحلیل)."""

    class Source(models.TextChoices):
        TIME = "time", "زمانِ حضور"
        GAME = "game", "بازی"
        MISSION = "mission", "مأموریت"
        MEDAL = "medal", "مدال"
        TEACHER = "teacher", "معلم"
        PARENT = "parent", "والدین"
        SHOP = "shop", "فروشگاه"
        SEED = "seed", "کاشت"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                             related_name="dew_log")
    amount = models.IntegerField()
    source = models.CharField(max_length=10, choices=Source.choices)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"+{self.amount} {self.source}"


class GardenShopItem(TimeStampedModel):
    """آیتم‌های فروشگاهِ باغچه — کاملاً قابل‌افزودن/تغییر از پنل ادمین."""

    class Kind(models.TextChoices):
        SEED = "seed", "دانه"
        FERTILIZER = "fertilizer", "کود"
        PLOT = "plot", "ارتقای باغچه"
        DECOR = "decor", "تزئین"

    item_key = models.SlugField(max_length=40, unique=True)
    title = models.CharField(max_length=80)
    description = models.CharField(max_length=160, blank=True)
    cost = models.PositiveIntegerField()                        # به شبنم
    kind = models.CharField(max_length=12, choices=Kind.choices)
    payload = models.CharField(max_length=40, blank=True)       # مثلا شناسه‌ی تزئین
    amount = models.PositiveSmallIntegerField(default=1)        # چند واحد می‌دهد (دانه/کود)
    is_active = models.BooleanField(default=True)
    sort = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["sort", "id"]

    def __str__(self):
        return f"{self.title} ({self.cost})"
