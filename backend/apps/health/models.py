from django.conf import settings
from django.db import models

from apps.common.models import TimeStampedModel

MOOD_CHOICES = [
    ("happy", "خوشحال"),
    ("calm", "آروم"),
    ("tired", "خسته"),
    ("sad", "ناراحت"),
    ("angry", "عصبانی"),
]

# هر نیم‌ساعت یک‌بار از بچه حالِ دلش را می‌پرسیم.
MOOD_INTERVAL_MINUTES = 30


class MoodCheckin(TimeStampedModel):
    """ثبتِ حالِ دلِ بچه — پایه‌ی تحلیلِ آینده و یادآورِ نیم‌ساعته."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                             related_name="mood_checkins", verbose_name="کاربر")
    mood = models.CharField(max_length=10, choices=MOOD_CHOICES, verbose_name="حال دل")

    class Meta:
        verbose_name = "ثبت حال"
        verbose_name_plural = "ثبت‌های حال"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["user", "-created_at"])]

    def __str__(self):
        return f"{self.user}:{self.mood}"


class Painting(TimeStampedModel):
    """
    نقاشیِ ذخیره‌شده (دکمه‌ی «نگهش‌دار») + حال و رنگ‌ها برای تحلیل.

    تصویر به‌جای MEDIA در دیتابیس می‌ماند و فقط از راهِ APIِ احرازشده
    برمی‌گردد: نقاشیِ بچه شخصی است و نباید با یک URLِ حدس‌زدنی از بیرون
    قابلِ دیدن باشد. بندانگشتی جدا نگه داشته می‌شود تا فهرستِ گالری سبک
    بماند و تصویرِ کامل فقط وقتی بیاید که بچه بازش کند.
    """

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                             related_name="paintings", verbose_name="کاربر")
    mood = models.CharField(max_length=10, choices=MOOD_CHOICES, blank=True,
                            verbose_name="حال دل")
    # {رنگ: تعداد خط}
    colors = models.JSONField(default=dict, blank=True, verbose_name="رنگ‌های به‌کاررفته")
    # بندانگشتیِ JPEG (data URL)
    thumbnail = models.TextField(blank=True, verbose_name="بندانگشتی")
    # تصویرِ کامل (data URL)
    image = models.TextField(blank=True, verbose_name="تصویر کامل")
    # اسمی که خودِ بچه گذاشته
    title = models.CharField(max_length=60, blank=True, verbose_name="اسم نقاشی")

    class Meta:
        verbose_name = "نقاشی"
        verbose_name_plural = "نقاشی‌ها"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Painting<{self.user}>"


class Secret(TimeStampedModel):
    """
    رازِ صندوقچه — payload سمت کلاینت با AES-GCM رمز شده و سرور فقط متنِ رمزشده را
    نگه می‌دارد؛ رمزِ بچه هرگز به سرور نمی‌رسد.
    """

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                             related_name="secrets", verbose_name="کاربر")
    title = models.CharField(max_length=120, verbose_name="عنوان")
    payload = models.TextField( verbose_name="متن رمزنگاری‌شده")

    class Meta:
        verbose_name = "راز صندوقچه"
        verbose_name_plural = "رازهای صندوقچه"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Secret<{self.user}>:{self.title}"


class BreathingSession(TimeStampedModel):
    """یک دورِ کاملِ تمرینِ تنفس ۴-۴-۴ — برای گزارشِ سلامتِ والدین."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                             related_name="breathing_sessions", verbose_name="کاربر")
    cycles = models.PositiveSmallIntegerField(default=1, verbose_name="تعداد دور")
    seconds = models.PositiveIntegerField(default=0, verbose_name="مدت (ثانیه)")

    class Meta:
        verbose_name = "تمرین تنفس"
        verbose_name_plural = "تمرین‌های تنفس"
        indexes = [models.Index(fields=["user", "created_at"])]

    def __str__(self):
        return f"{self.user} — {self.cycles} دور"
