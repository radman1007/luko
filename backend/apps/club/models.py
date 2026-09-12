from django.conf import settings
from django.db import models

from apps.common.models import TimeStampedModel


class MissionTemplate(TimeStampedModel):
    """
    تعریفِ یک مأموریت یا تسکِ ورزشی.
    - is_fixed: گزینه‌ی ثابتِ روزانه که برای همه هر روز می‌آید.
    - is_suggested: پیشنهادِ معلم/والدین (امتیازش کمی بیشتر).
    - قالب‌های غیرثابت با MissionAssignment به بچه‌ی خاص نسبت داده می‌شوند.
    """

    class Category(models.TextChoices):
        MISSION = "daily_mission", "مأموریت روزانه"
        SPORT = "sport", "ورزشی"

    title = models.CharField(max_length=120, verbose_name="عنوان")
    coin_reward = models.PositiveIntegerField(default=10, verbose_name="پاداش سکه")
    # نامِ آیکونِ فرانت
    icon = models.CharField(max_length=40, blank=True, verbose_name="آیکون")
    category = models.CharField(max_length=16, choices=Category.choices,
                                default=Category.MISSION, verbose_name="دسته")
    is_fixed = models.BooleanField(default=False, verbose_name="ثابتِ هر روز")
    # پیشنهادِ معلم/والدین
    is_suggested = models.BooleanField(default=False, verbose_name="پیشنهادی")
    is_active = models.BooleanField(default=True, verbose_name="فعال")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                   on_delete=models.SET_NULL, related_name="created_missions",
                                   verbose_name="سازنده")
    sort = models.PositiveSmallIntegerField(default=0, verbose_name="ترتیب نمایش")

    class Meta:
        verbose_name = "قالب مأموریت"
        verbose_name_plural = "قالب‌های مأموریت"
        ordering = ["sort", "id"]

    def __str__(self):
        return f"[{self.category}] {self.title}"


class MissionAssignment(TimeStampedModel):
    """نسبت‌دادنِ یک قالب به بچه‌ی خاص (دستیِ ادمین یا پیشنهادِ معلم/والد)."""

    template = models.ForeignKey(MissionTemplate, on_delete=models.CASCADE,
                                 related_name="assignments", verbose_name="قالب مأموریت")
    child = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                              related_name="mission_assignments", verbose_name="فرزند")
    # null = هر روز تا فعال است
    date = models.DateField(null=True, blank=True, verbose_name="تاریخ")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                   on_delete=models.SET_NULL, related_name="assigned_missions",
                                   verbose_name="واگذارکننده")
    is_active = models.BooleanField(default=True, verbose_name="فعال")

    class Meta:
        verbose_name = "مأموریت واگذارشده"
        verbose_name_plural = "مأموریت‌های واگذارشده"
        indexes = [models.Index(fields=["child", "date", "is_active"])]

    def __str__(self):
        return f"{self.template} → {self.child}"


class MissionCompletion(TimeStampedModel):
    """تکمیلِ یک مأموریت در یک روز — یک بار در روز پاداش می‌دهد."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                             related_name="mission_completions", verbose_name="کاربر")
    template = models.ForeignKey(MissionTemplate, on_delete=models.CASCADE,
                                 related_name="completions", verbose_name="قالب مأموریت")
    day = models.DateField(db_index=True, verbose_name="روز")
    coins_awarded = models.PositiveIntegerField(default=0, verbose_name="سکه داده‌شده")

    class Meta:
        verbose_name = "مأموریت انجام‌شده"
        verbose_name_plural = "مأموریت‌های انجام‌شده"
        unique_together = ("user", "template", "day")
        indexes = [models.Index(fields=["user", "day"])]

    def __str__(self):
        return f"{self.user} ✓ {self.template_id} @ {self.day}"


class Medal(TimeStampedModel):
    """مدال — تعداد و مشخصاتش کاملاً از پنل ادمین قابل‌تغییر است."""

    class Criteria(models.TextChoices):
        FIRST_TASK = "first_task", "اولین مأموریت"
        STREAK = "streak", "روزهای پیاپی"
        TOTAL_TASKS = "total_tasks", "جمعِ مأموریت‌ها"
        PURCHASES = "purchases", "خرید از فروشگاه"
        GAMES = "games", "بازی‌های کامل‌شده"

    key = models.SlugField(max_length=40, unique=True, verbose_name="شناسه مدال")
    title = models.CharField(max_length=80, verbose_name="عنوان")
    description = models.CharField(max_length=160, blank=True, verbose_name="توضیح")
    icon = models.CharField(max_length=40, blank=True, verbose_name="آیکون")
    criteria = models.CharField(max_length=16, choices=Criteria.choices,
                                verbose_name="شرط گرفتن")
    threshold = models.PositiveIntegerField(default=1, verbose_name="حد نصاب")
    is_active = models.BooleanField(default=True, verbose_name="فعال")
    sort = models.PositiveSmallIntegerField(default=0, verbose_name="ترتیب نمایش")

    class Meta:
        verbose_name = "مدال"
        verbose_name_plural = "مدال‌ها"
        ordering = ["sort", "id"]

    def __str__(self):
        return self.title


class ShopItem(TimeStampedModel):
    """جایزه‌ی فروشگاهِ کلاب — کاملاً از پنل ادمین قابل‌افزودن/تغییر."""

    item_key = models.SlugField(max_length=40, unique=True, verbose_name="شناسه جایزه")
    title = models.CharField(max_length=80, verbose_name="عنوان")
    description = models.CharField(max_length=160, blank=True, verbose_name="توضیح")
    icon = models.CharField(max_length=40, blank=True, verbose_name="آیکون")
    cost = models.PositiveIntegerField( verbose_name="قیمت (سکه)")
    is_active = models.BooleanField(default=True, verbose_name="فعال")
    sort = models.PositiveSmallIntegerField(default=0, verbose_name="ترتیب نمایش")

    class Meta:
        verbose_name = "جایزه فروشگاه"
        verbose_name_plural = "جایزه‌های فروشگاه"
        ordering = ["sort", "id"]

    def __str__(self):
        return f"{self.title} ({self.cost})"


class Purchase(TimeStampedModel):
    """خریدِ یک جایزه از فروشگاه — یک بار (unique)."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                             related_name="purchases", verbose_name="کاربر")
    item = models.ForeignKey(ShopItem, on_delete=models.CASCADE, related_name="purchases",
                             verbose_name="جایزه")

    class Meta:
        verbose_name = "خرید"
        verbose_name_plural = "خریدها"
        unique_together = ("user", "item")

    def __str__(self):
        return f"{self.user} bought {self.item}"
