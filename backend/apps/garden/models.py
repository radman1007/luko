from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.common.models import TimeStampedModel

from .constants import PLANT_KINDS


class GardenState(TimeStampedModel):
    """کلِ باغچه‌ی یک کاربر — شبنم، آب، کود، دانه، ارتقا، تزئین و فصلِ جاری."""

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                                related_name="garden", verbose_name="کاربر")
    # شبنم (ارز ویژه)
    dew = models.PositiveIntegerField(default=20, verbose_name="شبنم")
    fertilizer = models.PositiveIntegerField(default=1, verbose_name="کود")
    seeds = models.PositiveIntegerField(default=2, verbose_name="دانه")
    plot_level = models.PositiveSmallIntegerField(default=1, verbose_name="سطح باغچه")
    decor = models.JSONField(default=list, blank=True, verbose_name="تزئین‌ها")
    water_charges = models.PositiveSmallIntegerField(default=5, verbose_name="شارژ آب‌پاش")
    last_refill_at = models.DateTimeField(default=timezone.now, verbose_name="آخرین پر شدن آب")
    last_watered_at = models.DateTimeField(null=True, blank=True, verbose_name="آخرین آبیاری")
    season = models.CharField(max_length=10, default="autumn", verbose_name="فصل")
    season_start_at = models.DateTimeField(default=timezone.now, verbose_name="شروع فصل")

    class Meta:
        verbose_name = "باغچه"
        verbose_name_plural = "باغچه‌ها"

    def __str__(self):
        return f"Garden<{self.user}> dew={self.dew}"


class Plant(TimeStampedModel):
    """یک گیاهِ کاشته‌شده در باغچه. مرحله‌ی رشد از care حساب می‌شود."""

    garden = models.ForeignKey(GardenState, on_delete=models.CASCADE, related_name="plants",
                               verbose_name="باغچه")
    kind = models.CharField(max_length=20, choices=[(k, k) for k in PLANT_KINDS],
                            verbose_name="نوع گیاه")
    care = models.PositiveIntegerField(default=0, verbose_name="امتیاز مراقبت")
    planted_at = models.DateTimeField(default=timezone.now, verbose_name="تاریخ کاشت")

    class Meta:
        verbose_name = "گیاه"
        verbose_name_plural = "گیاهان"

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
                             related_name="dew_log", verbose_name="کاربر")
    amount = models.IntegerField( verbose_name="مقدار")
    source = models.CharField(max_length=10, choices=Source.choices, verbose_name="منبع")

    class Meta:
        verbose_name = "ثبت شبنم"
        verbose_name_plural = "دفترچه شبنم"
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

    item_key = models.SlugField(max_length=40, unique=True, verbose_name="شناسه کالا")
    title = models.CharField(max_length=80, verbose_name="عنوان")
    description = models.CharField(max_length=160, blank=True, verbose_name="توضیح")
    cost = models.PositiveIntegerField( verbose_name="قیمت (شبنم)")
    kind = models.CharField(max_length=12, choices=Kind.choices, verbose_name="نوع")
    # مثلا شناسه‌ی تزئین
    payload = models.CharField(max_length=40, blank=True, verbose_name="داده کالا")
    # چند واحد می‌دهد (دانه/کود)
    amount = models.PositiveSmallIntegerField(default=1, verbose_name="تعداد واحد")
    is_active = models.BooleanField(default=True, verbose_name="فعال")
    sort = models.PositiveSmallIntegerField(default=0, verbose_name="ترتیب نمایش")

    class Meta:
        verbose_name = "کالای فروشگاه باغچه"
        verbose_name_plural = "کالاهای فروشگاه باغچه"
        ordering = ["sort", "id"]

    def __str__(self):
        return f"{self.title} ({self.cost})"
