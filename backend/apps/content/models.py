"""
محتوای ادمین‌ویرایش‌پذیر: ویدیوهای لوکو تلویزیون، پادکست‌ها،
قانونِ روزِ جاده و خوراکیِ روز. همه از پنل ادمین اضافه/ویرایش می‌شوند.
"""
from django.conf import settings
from django.db import models

from apps.common.models import TimeStampedModel


class ContentBase(TimeStampedModel):
    title = models.CharField(max_length=140, verbose_name="عنوان")
    category = models.CharField(max_length=30, db_index=True, verbose_name="دسته")
    duration_minutes = models.PositiveSmallIntegerField(default=0, verbose_name="مدت (دقیقه)")
    # نامِ آیکونِ hi2 در فرانت
    icon = models.CharField(max_length=40, blank=True, verbose_name="آیکون")
    is_active = models.BooleanField(default=True, verbose_name="فعال")
    sort = models.PositiveSmallIntegerField(default=0, verbose_name="ترتیب نمایش")

    class Meta:
        abstract = True
        ordering = ["sort", "-created_at"]

    def __str__(self):
        return self.title


class Video(ContentBase):
    """ویدیوی لوکو تلویزیون. دسته‌ها: کارتون / علمی / قصه / موسیقی"""

    # منبعِ پخش (بعداً CDN)
    url = models.URLField(blank=True, verbose_name="نشانی پخش")
    thumbnail = models.URLField(blank=True, verbose_name="تصویر بندانگشتی")
    # سمت سرور شمرده می‌شود
    views = models.PositiveIntegerField(default=0, verbose_name="تعداد بازدید")

    class Meta:
        verbose_name = "ویدیو"
        verbose_name_plural = "ویدیوها"



class VideoInteraction(TimeStampedModel):
    """بازدید/لایکِ یک بچه روی یک ویدیو — برای هر جفت فقط یک ردیف."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                             related_name="video_interactions", verbose_name="کاربر")
    video = models.ForeignKey(Video, on_delete=models.CASCADE, related_name="interactions",
                              verbose_name="ویدیو")
    liked = models.BooleanField(default=False, verbose_name="پسندیده")
    viewed = models.BooleanField(default=False, verbose_name="دیده‌شده")

    class Meta:
        verbose_name = "بازخورد ویدیو"
        verbose_name_plural = "بازخوردهای ویدیو"
        unique_together = ("user", "video")
        indexes = [models.Index(fields=["user", "liked"])]

    def __str__(self):
        return f"{self.user} → {self.video}"


class Podcast(ContentBase):
    """قسمتِ پادکست. دسته‌ها: قصه / علمی / موسیقی / خواب"""

    audio_url = models.URLField(blank=True, verbose_name="نشانی صوت")

    class Meta:
        verbose_name = "پادکست"
        verbose_name_plural = "پادکست‌ها"



class PodcastListen(TimeStampedModel):
    """ثبتِ گوش‌دادن — برای گزارشِ والدین و «پادکست امروز»."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                             related_name="podcast_listens", verbose_name="کاربر")
    podcast = models.ForeignKey(Podcast, on_delete=models.CASCADE, related_name="listens",
                                verbose_name="پادکست")
    seconds = models.PositiveIntegerField(default=0, verbose_name="مدت (ثانیه)")

    class Meta:
        verbose_name = "گوش‌دادن پادکست"
        verbose_name_plural = "گوش‌دادن‌های پادکست"
        indexes = [models.Index(fields=["user", "created_at"])]

    def __str__(self):
        return f"{self.user} ♪ {self.podcast}"


class TrafficRule(TimeStampedModel):
    """قانونِ راهنمایی‌ورانندگی — هر روز یکی نشان داده می‌شود."""

    rule_key = models.SlugField(max_length=40, unique=True, verbose_name="شناسه قانون")
    text = models.CharField(max_length=200, verbose_name="متن قانون")
    has_game = models.BooleanField(default=False, verbose_name="بازی دارد")
    is_active = models.BooleanField(default=True, verbose_name="فعال")
    sort = models.PositiveSmallIntegerField(default=0, verbose_name="ترتیب نمایش")

    class Meta:
        verbose_name = "قانون راهنمایی و رانندگی"
        verbose_name_plural = "قانون‌های راهنمایی و رانندگی"
        ordering = ["sort", "id"]

    def __str__(self):
        return self.text[:50]


class Recipe(TimeStampedModel):
    """خوراکیِ روزِ سرآشپز زعفران."""

    recipe_key = models.SlugField(max_length=40, unique=True, verbose_name="شناسه دستور")
    name = models.CharField(max_length=80, verbose_name="نام خوراکی")
    intro = models.CharField(max_length=200, blank=True, verbose_name="معرفی")
    # ["آرد", "شیر", ...]
    ingredients = models.JSONField(default=list, blank=True, verbose_name="مواد لازم")
    has_game = models.BooleanField(default=False, verbose_name="بازی دارد")
    is_active = models.BooleanField(default=True, verbose_name="فعال")
    sort = models.PositiveSmallIntegerField(default=0, verbose_name="ترتیب نمایش")

    class Meta:
        verbose_name = "دستور آشپزی"
        verbose_name_plural = "دستورهای آشپزی"
        ordering = ["sort", "id"]

    def __str__(self):
        return self.name
