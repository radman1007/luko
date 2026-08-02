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

    title = models.CharField(max_length=120)
    coin_reward = models.PositiveIntegerField(default=10)
    icon = models.CharField(max_length=40, blank=True)          # نامِ آیکونِ فرانت
    category = models.CharField(max_length=16, choices=Category.choices,
                                default=Category.MISSION)
    is_fixed = models.BooleanField(default=False)               # گزینه‌ی ثابتِ هر روز
    is_suggested = models.BooleanField(default=False)           # پیشنهادِ معلم/والدین
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                   on_delete=models.SET_NULL, related_name="created_missions")
    sort = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["sort", "id"]

    def __str__(self):
        return f"[{self.category}] {self.title}"


class MissionAssignment(TimeStampedModel):
    """نسبت‌دادنِ یک قالب به بچه‌ی خاص (دستیِ ادمین یا پیشنهادِ معلم/والد)."""

    template = models.ForeignKey(MissionTemplate, on_delete=models.CASCADE,
                                 related_name="assignments")
    child = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                              related_name="mission_assignments")
    date = models.DateField(null=True, blank=True)              # null = هر روز تا فعال است
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                   on_delete=models.SET_NULL, related_name="assigned_missions")
    is_active = models.BooleanField(default=True)

    class Meta:
        indexes = [models.Index(fields=["child", "date", "is_active"])]

    def __str__(self):
        return f"{self.template} → {self.child}"


class MissionCompletion(TimeStampedModel):
    """تکمیلِ یک مأموریت در یک روز — یک بار در روز پاداش می‌دهد."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                             related_name="mission_completions")
    template = models.ForeignKey(MissionTemplate, on_delete=models.CASCADE,
                                 related_name="completions")
    day = models.DateField(db_index=True)
    coins_awarded = models.PositiveIntegerField(default=0)

    class Meta:
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

    key = models.SlugField(max_length=40, unique=True)
    title = models.CharField(max_length=80)
    description = models.CharField(max_length=160, blank=True)
    icon = models.CharField(max_length=40, blank=True)
    criteria = models.CharField(max_length=16, choices=Criteria.choices)
    threshold = models.PositiveIntegerField(default=1)
    is_active = models.BooleanField(default=True)
    sort = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["sort", "id"]

    def __str__(self):
        return self.title


class ShopItem(TimeStampedModel):
    """جایزه‌ی فروشگاهِ کلاب — کاملاً از پنل ادمین قابل‌افزودن/تغییر."""

    item_key = models.SlugField(max_length=40, unique=True)
    title = models.CharField(max_length=80)
    description = models.CharField(max_length=160, blank=True)
    icon = models.CharField(max_length=40, blank=True)
    cost = models.PositiveIntegerField()                       # به سکه
    is_active = models.BooleanField(default=True)
    sort = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["sort", "id"]

    def __str__(self):
        return f"{self.title} ({self.cost})"


class Purchase(TimeStampedModel):
    """خریدِ یک جایزه از فروشگاه — یک بار (unique)."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                             related_name="purchases")
    item = models.ForeignKey(ShopItem, on_delete=models.CASCADE, related_name="purchases")

    class Meta:
        unique_together = ("user", "item")

    def __str__(self):
        return f"{self.user} bought {self.item}"
