"""
حضورِ کاربران روی سایت و اپِ اندروید.

هر صفحه‌ی باز (و دیده‌شده) دقیقه‌ای یک‌بار به سرور می‌گوید «هستم». هر بازدیدکننده
در هر ساعت یک ردیف دارد و هر ضربان یک دقیقه به آن اضافه می‌کند؛ از همین ردیف‌ها
«الان آنلاین»، «فعال در ساعت/روز» و «میانگینِ دقیقه» ساخته می‌شود. اپِ اندروید
فقط وقتی اینترنت دارد ضربان می‌فرستد، پس استفاده‌ی آفلاین شمرده نمی‌شود.
"""
from django.conf import settings
from django.db import models


class ActivitySlot(models.Model):
    class Platform(models.TextChoices):
        WEB = "web", "وب"
        ANDROID = "android", "اندروید"

    class Audience(models.TextChoices):
        STUDENT = "student", "دانش‌آموز"
        PARENT = "parent", "والد"
        STAFF = "staff", "تیم"
        GUEST = "guest", "مهمان"

    #: «u:12» برای کاربر، «g:<شناسه‌ی دستگاه>» برای مهمان
    visitor = models.CharField(max_length=48, verbose_name="بازدیدکننده")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True,
                             related_name="activity_slots", verbose_name="کاربر")
    audience = models.CharField(max_length=10, choices=Audience.choices, verbose_name="گروه")
    platform = models.CharField(max_length=10, choices=Platform.choices, verbose_name="سکو")
    #: آغازِ ساعت به وقتِ تهران (ذخیره به UTC)؛ مرزِ ساعت‌ها با ساعتِ تهران یکی است
    hour = models.DateTimeField(verbose_name="ساعت")
    minutes = models.PositiveSmallIntegerField(default=1, verbose_name="دقیقه")
    last_beat = models.DateTimeField(verbose_name="آخرین ضربان")

    class Meta:
        verbose_name = "حضور (ساعتی)"
        verbose_name_plural = "حضورها (ساعتی)"
        constraints = [
            models.UniqueConstraint(fields=["visitor", "platform", "hour"], name="uniq_activity_slot"),
        ]
        indexes = [
            models.Index(fields=["hour", "platform"]),
            models.Index(fields=["last_beat"]),
            models.Index(fields=["user", "hour"]),
        ]

    def __str__(self):
        return f"{self.visitor} · {self.platform} · {self.hour:%Y-%m-%d %H}"
