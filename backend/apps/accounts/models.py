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

    # شماره عمداً یکتا نیست: خیلی از بچه‌ها با شماره‌ی پدر/مادرشان ثبت‌نام
    # می‌کنند، پس یک شماره می‌تواند هم‌زمان یک حسابِ دانش‌آموز و یک حسابِ
    # والد داشته باشد. یکتاییِ واقعی روی جفتِ (شماره، نقش) است.
    phone = models.CharField(max_length=15, db_index=True)
    first_name = models.CharField(max_length=60, blank=True)
    last_name = models.CharField(max_length=60, blank=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.STUDENT)

    # پایه‌ی تحصیلیِ دانش‌آموز. مسیرِ سیزن فقط بازی‌های همین پایه را
    # نشان می‌دهد؛ پایه‌ای که هنوز محتوا ندارد «به‌زودی» می‌بیند، نه
    # بازی‌های پایه‌ی دیگر.
    grade = models.PositiveSmallIntegerField(default=1)

    # هر ورودِ موفق این را یکی جلو می‌برد و توکنِ قدیمی باطل می‌شود.
    # یعنی ورود از گوشیِ تازه، نشستِ گوشیِ قبلی را می‌بندد — خواسته‌ی
    # صریحِ محصول: هر بچه هم‌زمان روی یک دستگاه.
    session_version = models.PositiveIntegerField(default=0)

    # ثبت‌نام فعلاً بدونِ تأییدِ شماره است؛ تأیید کارِ اختیاریِ بعدی است
    # که والد هر وقت خواست از پنل انجام می‌دهد.
    phone_verified = models.BooleanField(default=False)
    phone_verified_at = models.DateTimeField(null=True, blank=True)

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

    class Meta:
        constraints = [
            # یک شماره فقط یک حسابِ والد/معلم/ادمین دارد.
            #
            # دانش‌آموز عمداً بیرونِ این قانون است: یک خانواده می‌تواند چند
            # بچه با یک شماره داشته باشد و رمزشان آن‌ها را از هم جدا
            # می‌کند. یکتاییِ (شماره، نقش) این را ناممکن می‌کرد.
            models.UniqueConstraint(
                fields=["phone", "role"],
                condition=~models.Q(role="student"),
                name="uniq_user_phone_role_staff",
            ),
        ]

    def __str__(self):
        name = f"{self.first_name} {self.last_name}".strip()
        return name or self.phone


class PasswordVault(TimeStampedModel):
    """
    نسخه‌ی رمزنگاری‌شده‌ی رمزِ کاربر، فقط برای پشتیبانیِ تلفنی.

    رمزِ احراز هویت مثل همیشه در `User.password` هَش می‌شود؛ این جداست و
    با کلیدِ سرور باز می‌شود. با هر تغییرِ رمز به‌روز می‌شود.
    """

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="password_vault")
    sealed = models.TextField(blank=True)

    def set_password(self, raw: str) -> None:
        from .vault import seal
        self.sealed = seal(raw)

    def reveal(self) -> str | None:
        from .vault import open_sealed
        return open_sealed(self.sealed)

    def __str__(self):
        return f"PasswordVault<{self.user}>"


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
