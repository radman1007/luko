"""
هوش مصنوعی: کارنامه‌ی هر درخواست به گیت‌وی (هزینه و سهمیه)، تحلیلِ ذخیره‌شده‌ی هر بچه، و گفت‌وگوی
دستیارِ والدین. گیت‌وی حافظه ندارد؛ تاریخچه‌ی گفت‌وگو را خودمان نگه می‌داریم.
"""
from django.conf import settings
from django.db import models

from apps.common.models import TimeStampedModel

TIER_CHOICES = [("flash", "پایه"), ("pro", "حرفه‌ای"), ("luna", "پیشرفته")]


class AIUsage(models.Model):
    """یک درخواست به مدل — برای دیدنِ مصرفِ توکن و شمردنِ سهمیه‌ی روزانه"""

    class Feature(models.TextChoices):
        INSIGHT = "insight", "تحلیلِ گزارش"
        ASSISTANT = "assistant", "دستیارِ والدین"

    created_at = models.DateTimeField(auto_now_add=True, db_index=True, verbose_name="زمان")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
                             related_name="+", verbose_name="والد")
    child = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
                              related_name="+", verbose_name="فرزند")
    feature = models.CharField(max_length=12, choices=Feature.choices, verbose_name="بخش")
    tier = models.CharField(max_length=8, choices=TIER_CHOICES, verbose_name="سطح")
    model = models.CharField(max_length=60, verbose_name="مدل")
    ok = models.BooleanField(default=True, verbose_name="موفق")
    error = models.CharField(max_length=200, blank=True, verbose_name="خطا")
    prompt_tokens = models.PositiveIntegerField(default=0, verbose_name="توکنِ ورودی")
    completion_tokens = models.PositiveIntegerField(default=0, verbose_name="توکنِ خروجی")
    reasoning_tokens = models.PositiveIntegerField(default=0, verbose_name="توکنِ استدلال")
    latency_ms = models.PositiveIntegerField(default=0, verbose_name="زمانِ پاسخ (میلی‌ثانیه)")

    class Meta:
        verbose_name = "درخواستِ هوش مصنوعی"
        verbose_name_plural = "مصرفِ هوش مصنوعی"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["user", "feature", "tier", "created_at"])]

    def __str__(self):
        return f"{self.get_feature_display()} · {self.model}"


class AIInsight(TimeStampedModel):
    """
    آخرین تحلیلِ پذیرفته‌شده‌ی یک بچه برای یک نسخه (کامل یا رایگان). `fingerprint` اثرِ همان
    برگه‌ی داده است؛ اگر داده عوض شده باشد این تحلیل نشان داده نمی‌شود (عددهایش کهنه است).
    `payload` بی‌نام است — نام هنگامِ نمایش جای «[نام]» می‌نشیند.
    """

    class Variant(models.TextChoices):
        FULL = "full", "کامل (با اشتراک)"
        FREE = "free", "رایگان"

    child = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="ai_insights",
                              verbose_name="فرزند")
    variant = models.CharField(max_length=4, choices=Variant.choices, verbose_name="نسخه")
    fingerprint = models.CharField(max_length=64, verbose_name="اثرِ داده")
    tier = models.CharField(max_length=8, choices=TIER_CHOICES, verbose_name="سطح")
    model = models.CharField(max_length=60, verbose_name="مدل")
    payload = models.JSONField(default=dict, verbose_name="متن‌ها")
    rejected = models.JSONField(default=dict, blank=True, verbose_name="بخش‌های ردشده")

    class Meta:
        verbose_name = "تحلیلِ هوشمند"
        verbose_name_plural = "تحلیل‌های هوشمند"
        constraints = [models.UniqueConstraint(fields=["child", "variant"], name="ai_insight_child_variant")]

    def __str__(self):
        return f"{self.child} · {self.get_variant_display()}"


class AssistantMessage(TimeStampedModel):
    """یک پیام در گفت‌وگوی والد با دستیار درباره‌ی یک فرزند"""

    class Role(models.TextChoices):
        USER = "user", "والد"
        ASSISTANT = "assistant", "دستیار"

    class Status(models.TextChoices):
        PENDING = "pending", "در حالِ پاسخ"
        DONE = "done", "پاسخ داده شد"
        FAILED = "failed", "ناموفق"

    parent = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                               related_name="assistant_messages", verbose_name="والد")
    child = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="+",
                              verbose_name="فرزند")
    role = models.CharField(max_length=10, choices=Role.choices, verbose_name="گوینده")
    content = models.TextField(blank=True, verbose_name="متن")
    tier = models.CharField(max_length=8, choices=TIER_CHOICES, blank=True, verbose_name="سطح")
    model = models.CharField(max_length=60, blank=True, verbose_name="مدل")
    status = models.CharField(max_length=8, choices=Status.choices, default=Status.DONE, verbose_name="وضعیت")
    error = models.CharField(max_length=200, blank=True, verbose_name="خطا")

    class Meta:
        verbose_name = "پیامِ دستیار"
        verbose_name_plural = "گفت‌وگوهای دستیار"
        ordering = ["created_at", "id"]
        indexes = [models.Index(fields=["parent", "child", "created_at"])]

    def __str__(self):
        return f"{self.get_role_display()}: {self.content[:40]}"
