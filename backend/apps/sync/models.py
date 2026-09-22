"""
داده‌ی دستگاهِ بچه، هم‌رسان بینِ همه‌ی دستگاه‌هایش.

بخشی از وضعیتِ بچه (کیفِ سکه‌ی بازی‌ها، باغچه، مأموریت‌های امروز، ذخیره‌ی
داخلِ هر بازی و …) هنوز سمتِ خودِ اپ حساب می‌شود و فقط در localStorage بود؛
پس سایت و اپِ اندروید برای یک حساب دو عددِ جدا نشان می‌دادند. این‌جا همان
مقدارها — دست‌نخورده، به‌صورتِ متن — برای هر حساب نگه داشته می‌شوند تا هر
دستگاه همان را ببیند.

سرور چیزی از این مقدارها حساب یا اعطا نمی‌کند (مثلِ «ذخیره‌ی ابری» در
بازی‌ها). مقدارهای باارزشی که سرور خودش می‌دهد — سکه‌ی مرحله، گنج، ستاره —
جای خودشان را دارند و از این‌جا خوانده نمی‌شوند.
"""
from django.conf import settings
from django.db import models

from apps.common.models import TimeStampedModel


class KidData(TimeStampedModel):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                             related_name="synced_data", verbose_name="کاربر")
    key = models.CharField(max_length=120, verbose_name="کلید")
    # null یعنی «پاک شد»؛ ردیف می‌ماند تا دستگاهِ دیگر هم پاک‌شدن را بفهمد
    value = models.TextField(null=True, blank=True, verbose_name="مقدار")
    # هر نوشتن یکی بالا می‌رود؛ نوشتن فقط روی نسخه‌ای که دستگاه دیده پذیرفته می‌شود
    version = models.PositiveIntegerField(default=0, verbose_name="نسخه")

    class Meta:
        verbose_name = "داده‌ی همگام‌شده"
        verbose_name_plural = "داده‌های همگام‌شده"
        constraints = [models.UniqueConstraint(fields=["user", "key"], name="sync_unique_user_key")]
        indexes = [models.Index(fields=["user", "updated_at"])]

    def __str__(self):
        return f"{self.user_id}:{self.key}@{self.version}"
