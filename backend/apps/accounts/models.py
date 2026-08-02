from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models

from apps.common.models import TimeStampedModel

from .managers import UserManager


class User(AbstractBaseUser, PermissionsMixin):
    """کاربرِ شماره‌محور با نقش. یک User = یک بچه/والد/معلم/ادمین."""

    class Role(models.TextChoices):
        STUDENT = "student", "دانش‌آموز"
        PARENT = "parent", "والد"
        TEACHER = "teacher", "معلم"
        SCHOOL_ADMIN = "school_admin", "مدیر مدرسه"
        TEAM_ADMIN = "team_admin", "ادمین تیم"

    phone = models.CharField(max_length=15, unique=True, db_index=True)
    first_name = models.CharField(max_length=60, blank=True)
    last_name = models.CharField(max_length=60, blank=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.STUDENT)

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(auto_now_add=True)

    # پیوند والد/معلم ← بچه (برای پنل‌های آینده). یک بچه می‌تواند چند سرپرست داشته باشد.
    guardians = models.ManyToManyField(
        "self", symmetrical=False, related_name="children", blank=True
    )

    objects = UserManager()

    USERNAME_FIELD = "phone"
    REQUIRED_FIELDS = []

    def __str__(self):
        name = f"{self.first_name} {self.last_name}".strip()
        return name or self.phone


class Profile(TimeStampedModel):
    """شمارنده‌های باارزشِ کاربر — همیشه سمت سرور معتبر (فرانت فقط نمایش)."""

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    coins = models.PositiveIntegerField(default=0)          # سکه‌ی معمولی
    points = models.PositiveIntegerField(default=0)         # جمع امتیازها
    treasures = models.PositiveIntegerField(default=0)      # گنج (ارز ویژه‌ی کارگاه)

    def __str__(self):
        return f"Profile<{self.user}>"


class KidSettings(TimeStampedModel):
    """تنظیمات بچه — تا خودش عوض نکند تغییر نمی‌کند. extra برای گزینه‌های آینده."""

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="settings")
    sound = models.BooleanField(default=True)               # صدای افکت‌ها
    music = models.BooleanField(default=True)               # موسیقی پس‌زمینه
    mood_reminder = models.BooleanField(default=True)       # یادآور ثبت حال
    extra = models.JSONField(default=dict, blank=True)      # گزینه‌های آتی

    def __str__(self):
        return f"Settings<{self.user}>"


class Lukorian(TimeStampedModel):
    """کاراکتر اختصاصیِ ساخته‌شده در «کارگاه لوکوریان‌سازی»."""

    class CustomStatus(models.TextChoices):
        NONE = "none", "درخواست‌نشده"
        REQUESTED = "requested", "در حال ساخت"
        DELIVERED = "delivered", "تحویل‌شده"

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="lukorian")
    unlocked = models.BooleanField(default=False)           # کارگاه باز شده؟
    is_built = models.BooleanField(default=False)           # کاراکتر ساخته شده؟
    # آیتم‌های ظاهریِ خریداری‌شده و پیکربندیِ انتخاب‌شده
    owned_items = models.JSONField(default=list, blank=True)
    config = models.JSONField(default=dict, blank=True)
    custom_status = models.CharField(
        max_length=12, choices=CustomStatus.choices, default=CustomStatus.NONE
    )

    def __str__(self):
        return f"Lukorian<{self.user}>"
