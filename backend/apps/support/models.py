"""
تیکت پشتیبانی — پنلِ والدین (تنظیمات ← پشتیبانی) و داشبوردِ تیم.

هر تیکت دسته و (اختیاری) فرزندِ مربوط دارد تا تیم بی‌پرسیدن بداند موضوع چیست؛ والدِ مشترک
اولویتِ «بالا» می‌گیرد. `user_seen_at` لحظه‌ی آخرین بازدیدِ والد است و پاسخ‌های تازه‌ی تیم از
روی همین «خوانده‌نشده» شمرده می‌شوند. بعد از پاسخ یا بستن، والد می‌تواند به پشتیبانی امتیاز بدهد.
"""
from django.conf import settings
from django.db import models

from apps.common.models import TimeStampedModel


class Ticket(TimeStampedModel):
    class Status(models.TextChoices):
        OPEN = "open", "باز"
        ANSWERED = "answered", "پاسخ داده شده"
        CLOSED = "closed", "بسته"

    class Category(models.TextChoices):
        ACCOUNT = "account", "حساب و ورود"
        BILLING = "billing", "اشتراک و پرداخت"
        REPORTS = "reports", "گزارش‌ها و پنل"
        GAMES = "games", "بازی‌ها و محتوا"
        TECHNICAL = "technical", "مشکلِ فنی"
        IDEA = "idea", "پیشنهاد و انتقاد"
        OTHER = "other", "سایر"

    class Priority(models.TextChoices):
        NORMAL = "normal", "عادی"
        HIGH = "high", "بالا"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                             related_name="tickets", verbose_name="فرستنده")
    subject = models.CharField(max_length=140, verbose_name="موضوع")
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.OPEN,
                              verbose_name="وضعیت")
    category = models.CharField(max_length=12, choices=Category.choices, default=Category.OTHER,
                                verbose_name="دسته")
    priority = models.CharField(max_length=8, choices=Priority.choices, default=Priority.NORMAL,
                                verbose_name="اولویت")
    child = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
                              related_name="child_tickets", verbose_name="فرزندِ مربوط")
    user_seen_at = models.DateTimeField(null=True, blank=True, verbose_name="آخرین بازدیدِ فرستنده")
    closed_at = models.DateTimeField(null=True, blank=True, verbose_name="زمانِ بستن")
    rating = models.PositiveSmallIntegerField(null=True, blank=True, verbose_name="امتیاز به پشتیبانی")
    rating_comment = models.CharField(max_length=300, blank=True, verbose_name="نظر درباره‌ی پاسخ")

    class Meta:
        verbose_name = "تیکت پشتیبانی"
        verbose_name_plural = "تیکت‌های پشتیبانی"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["user", "status"])]

    def __str__(self):
        return f"#{self.pk} {self.subject}"

    @property
    def code(self) -> str:
        """شماره‌ی پیگیریِ قابلِ گفتن: LK-1042"""
        return f"LK-{1000 + self.pk}"


class TicketMessage(TimeStampedModel):
    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name="messages",
                               verbose_name="تیکت")
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                               related_name="ticket_messages", verbose_name="فرستنده")
    body = models.TextField( verbose_name="متن پیام")
    is_staff_reply = models.BooleanField(default=False, verbose_name="پاسخ تیم پشتیبانی")

    class Meta:
        verbose_name = "پیام تیکت"
        verbose_name_plural = "پیام‌های تیکت"
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.ticket_id} ← {self.sender}"
