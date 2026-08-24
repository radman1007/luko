"""پیوندِ والد و فرزند — پایه‌ی همه‌ی گزارش‌های پنل والدین."""
from django.conf import settings
from django.db import models

from apps.common.models import TimeStampedModel


class ParentChild(TimeStampedModel):
    """
    یک والد می‌تواند چند فرزند داشته باشد و یک فرزند چند سرپرست
    (مثلاً پدر و مادر). دسترسیِ گزارش‌ها فقط از روی همین جدول داده می‌شود.
    """

    class Relation(models.TextChoices):
        PARENT = "parent", "والد"
        GUARDIAN = "guardian", "سرپرست"

    parent = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                               related_name="children_links")
    child = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                              related_name="parent_links")
    relation = models.CharField(max_length=12, choices=Relation.choices,
                                default=Relation.PARENT)
    grade = models.PositiveSmallIntegerField(default=1)      # پایه‌ی تحصیلی
    school = models.CharField(max_length=120, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ("parent", "child")
        indexes = [models.Index(fields=["parent", "is_active"])]

    def __str__(self):
        return f"{self.parent} → {self.child}"


class DailyAssignment(TimeStampedModel):
    """
    «بازی روزِ» انتخابی والد برای فرزند در یک تاریخ مشخص.
    برای هر بچه در هر روز فقط یک بازی — دوباره ثبت کردن، همان ردیف را عوض می‌کند.
    """

    child = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                              related_name="daily_assignments")
    assigned_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                    null=True, blank=True, related_name="assignments_made")
    game_slug = models.SlugField(max_length=80)
    date = models.DateField(db_index=True)
    note = models.CharField(max_length=160, blank=True)      # پیام کوتاه والد به بچه

    class Meta:
        unique_together = ("child", "date")
        ordering = ["-date"]
        indexes = [models.Index(fields=["child", "date"])]

    def __str__(self):
        return f"{self.child} @ {self.date} → {self.game_slug}"


class ParentPreference(TimeStampedModel):
    """تنظیم‌های حسابِ والد — چیزهایی که در تبِ «تنظیمات» سوییچ دارند."""

    parent = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                                  related_name="parent_preference")
    weekly_report = models.BooleanField(default=True)      # اعلانِ گزارشِ هفتگی
    activity_alerts = models.BooleanField(default=True)    # اعلانِ فعالیت/بی‌فعالیتی

    def __str__(self):
        return f"تنظیمات {self.parent}"


class Notification(TimeStampedModel):
    """
    اعلانِ والد. ردیف‌ها از داده‌ی واقعی ساخته می‌شوند (نه دستی) و با
    `dedup_key` یکتا می‌مانند تا هر رویداد فقط یک‌بار اعلان بسازد.
    """

    class Kind(models.TextChoices):
        WEEKLY = "weekly", "گزارش هفتگی"
        GAMES = "games", "بازی‌های هفته"
        MOOD = "mood", "ثبت حال"
        IDLE = "idle", "بی‌فعالیتی"
        ASSIGNMENT = "assignment", "بازی روز"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                             related_name="parent_notifications")
    child = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                              null=True, blank=True, related_name="about_notifications")
    kind = models.CharField(max_length=12, choices=Kind.choices)
    title = models.CharField(max_length=160)
    body = models.CharField(max_length=240, blank=True)
    dedup_key = models.CharField(max_length=120)
    is_read = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]
        unique_together = ("user", "dedup_key")
        indexes = [models.Index(fields=["user", "is_read"])]

    def __str__(self):
        return f"{self.user} · {self.title}"
