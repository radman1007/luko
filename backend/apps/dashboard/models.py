from django.conf import settings
from django.db import models

from apps.common.models import TimeStampedModel


class StaffAccess(TimeStampedModel):
    """دسترسی‌های یک کارمند در داشبورد (مدیرِ کل نیازی به این ردیف ندارد)."""

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                                related_name="staff_access", verbose_name="کارمند")
    #: مثلاً «نویسنده‌ی وبلاگ» یا «پشتیبان»
    title = models.CharField(max_length=60, blank=True, verbose_name="سمت")
    capabilities = models.JSONField(default=list, blank=True, verbose_name="دسترسی‌ها")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True,
                                   related_name="+", verbose_name="تعریف‌کننده")

    class Meta:
        verbose_name = "دسترسیِ کارمند"
        verbose_name_plural = "دسترسی‌های کارمندان"

    def __str__(self):
        return f"{self.user} · {self.title}"


class AuditLog(models.Model):
    """هر کارِ مهم در داشبورد (و هر ورود) — چه کسی، چه کاری، روی چه چیزی، از کجا."""

    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
                              related_name="+", verbose_name="انجام‌دهنده")
    actor_label = models.CharField(max_length=120, blank=True, verbose_name="نامِ انجام‌دهنده")
    action = models.CharField(max_length=40, db_index=True, verbose_name="کار")
    target_type = models.CharField(max_length=30, blank=True, verbose_name="نوعِ هدف")
    target_id = models.CharField(max_length=40, blank=True, verbose_name="شناسه‌ی هدف")
    target_label = models.CharField(max_length=200, blank=True, verbose_name="هدف")
    details = models.JSONField(default=dict, blank=True, verbose_name="جزئیات")
    ip = models.CharField(max_length=64, blank=True, verbose_name="IP")
    user_agent = models.CharField(max_length=200, blank=True, verbose_name="مرورگر")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True, verbose_name="زمان")

    class Meta:
        verbose_name = "گزارشِ فعالیت"
        verbose_name_plural = "گزارشِ فعالیت‌ها"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["actor", "created_at"]), models.Index(fields=["target_type", "target_id"])]

    def __str__(self):
        return f"{self.actor_label} · {self.action}"
