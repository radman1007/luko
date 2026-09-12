"""تیکت پشتیبانی — استفاده در پنل والدین و بعداً پنل معلم/مدرسه."""
from django.conf import settings
from django.db import models

from apps.common.models import TimeStampedModel


class Ticket(TimeStampedModel):
    class Status(models.TextChoices):
        OPEN = "open", "باز"
        ANSWERED = "answered", "پاسخ داده شده"
        CLOSED = "closed", "بسته"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                             related_name="tickets", verbose_name="فرستنده")
    subject = models.CharField(max_length=140, verbose_name="موضوع")
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.OPEN,
                              verbose_name="وضعیت")

    class Meta:
        verbose_name = "تیکت پشتیبانی"
        verbose_name_plural = "تیکت‌های پشتیبانی"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["user", "status"])]

    def __str__(self):
        return f"#{self.pk} {self.subject}"


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
