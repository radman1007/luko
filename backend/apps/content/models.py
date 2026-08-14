"""
محتوای ادمین‌ویرایش‌پذیر: ویدیوهای لوکو تلویزیون، پادکست‌ها،
قانونِ روزِ جاده و خوراکیِ روز. همه از پنل ادمین اضافه/ویرایش می‌شوند.
"""
from django.conf import settings
from django.db import models

from apps.common.models import TimeStampedModel


class ContentBase(TimeStampedModel):
    title = models.CharField(max_length=140)
    category = models.CharField(max_length=30, db_index=True)
    duration_minutes = models.PositiveSmallIntegerField(default=0)
    icon = models.CharField(max_length=40, blank=True)      # نامِ آیکونِ hi2 در فرانت
    is_active = models.BooleanField(default=True)
    sort = models.PositiveSmallIntegerField(default=0)

    class Meta:
        abstract = True
        ordering = ["sort", "-created_at"]

    def __str__(self):
        return self.title


class Video(ContentBase):
    """ویدیوی لوکو تلویزیون. دسته‌ها: کارتون / علمی / قصه / موسیقی"""

    url = models.URLField(blank=True)                       # منبعِ پخش (بعداً CDN)
    thumbnail = models.URLField(blank=True)
    views = models.PositiveIntegerField(default=0)          # سمت سرور شمرده می‌شود


class VideoInteraction(TimeStampedModel):
    """بازدید/لایکِ یک بچه روی یک ویدیو — برای هر جفت فقط یک ردیف."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                             related_name="video_interactions")
    video = models.ForeignKey(Video, on_delete=models.CASCADE, related_name="interactions")
    liked = models.BooleanField(default=False)
    viewed = models.BooleanField(default=False)

    class Meta:
        unique_together = ("user", "video")
        indexes = [models.Index(fields=["user", "liked"])]

    def __str__(self):
        return f"{self.user} → {self.video}"


class Podcast(ContentBase):
    """قسمتِ پادکست. دسته‌ها: قصه / علمی / موسیقی / خواب"""

    audio_url = models.URLField(blank=True)


class PodcastListen(TimeStampedModel):
    """ثبتِ گوش‌دادن — برای گزارشِ والدین و «پادکست امروز»."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                             related_name="podcast_listens")
    podcast = models.ForeignKey(Podcast, on_delete=models.CASCADE, related_name="listens")
    seconds = models.PositiveIntegerField(default=0)        # چقدر گوش داد

    class Meta:
        indexes = [models.Index(fields=["user", "created_at"])]

    def __str__(self):
        return f"{self.user} ♪ {self.podcast}"


class TrafficRule(TimeStampedModel):
    """قانونِ راهنمایی‌ورانندگی — هر روز یکی نشان داده می‌شود."""

    rule_key = models.SlugField(max_length=40, unique=True)
    text = models.CharField(max_length=200)
    has_game = models.BooleanField(default=False)           # بازیِ عملی‌اش آماده است؟
    is_active = models.BooleanField(default=True)
    sort = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["sort", "id"]

    def __str__(self):
        return self.text[:50]


class Recipe(TimeStampedModel):
    """خوراکیِ روزِ سرآشپز زعفران."""

    recipe_key = models.SlugField(max_length=40, unique=True)
    name = models.CharField(max_length=80)
    intro = models.CharField(max_length=200, blank=True)
    ingredients = models.JSONField(default=list, blank=True)   # ["آرد", "شیر", ...]
    has_game = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    sort = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["sort", "id"]

    def __str__(self):
        return self.name
