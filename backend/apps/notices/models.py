"""
اعلانی که تیم از داشبورد می‌فرستد.

`Broadcast` خودِ ارسال است (چه کسی، به چه گروهی، با چه فیلتری، به چند نفر). برای
والدین همان اعلانِ پنلِ والدین ساخته می‌شود (parent.Notification از نوعِ «اطلاعیه»)؛
بچه‌ها صندوقِ خودشان را دارند (`KidNotice`).
"""
from django.conf import settings
from django.db import models

from apps.common.models import TimeStampedModel


class Broadcast(TimeStampedModel):
    class Audience(models.TextChoices):
        PARENTS = "parents", "والدین"
        STUDENTS = "students", "دانش‌آموزان"

    audience = models.CharField(max_length=10, choices=Audience.choices, verbose_name="گیرندگان")
    title = models.CharField(max_length=120, verbose_name="عنوان")
    body = models.CharField(max_length=240, blank=True, verbose_name="متن")
    #: مسیرِ داخلِ اپ (مثلاً /luko-podcast)؛ خالی یعنی فقط خبر
    link = models.CharField(max_length=200, blank=True, verbose_name="پیوند")
    #: فیلترهایی که گیرندگان با آن انتخاب شدند — برای گزارش و تکرار
    filters = models.JSONField(default=dict, blank=True, verbose_name="فیلترها")
    filters_label = models.CharField(max_length=300, blank=True, verbose_name="شرحِ فیلترها")
    recipients = models.PositiveIntegerField(default=0, verbose_name="تعداد گیرنده")
    sent_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True,
                                related_name="+", verbose_name="فرستنده")

    class Meta:
        verbose_name = "اعلانِ همگانی"
        verbose_name_plural = "اعلان‌های همگانی"
        ordering = ["-created_at"]

    def __str__(self):
        return self.title


class KidNotice(TimeStampedModel):
    """پیامی در صندوقِ اعلانِ بچه."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                             related_name="kid_notices", verbose_name="دانش‌آموز")
    broadcast = models.ForeignKey(Broadcast, on_delete=models.CASCADE, null=True, blank=True,
                                  related_name="kid_notices", verbose_name="اعلانِ همگانی")
    title = models.CharField(max_length=120, verbose_name="عنوان")
    body = models.CharField(max_length=240, blank=True, verbose_name="متن")
    link = models.CharField(max_length=200, blank=True, verbose_name="پیوند")
    is_read = models.BooleanField(default=False, verbose_name="خوانده شده")

    class Meta:
        verbose_name = "پیامِ دانش‌آموز"
        verbose_name_plural = "پیام‌های دانش‌آموزان"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["user", "broadcast"], name="uniq_kid_notice_broadcast"),
        ]
        indexes = [models.Index(fields=["user", "is_read"])]

    def __str__(self):
        return f"{self.user} · {self.title}"
