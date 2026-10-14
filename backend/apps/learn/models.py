"""
آموزشِ والدین: مقاله، ویدیو و پادکستِ صفحه‌ی «آموزش» در پنلِ والدین.

تیم از داشبورد (یا پنلِ جنگو) می‌نویسد و بارگذاری می‌کند. محتوای «ویژه» برای والدی که هیچ فرزندِ
مشترکی ندارد فقط با عنوان، خلاصه و چند خطِ اول دیده می‌شود (apps/learn/services.py).
"""
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import FileExtensionValidator
from django.db import models
from django.utils import timezone

from apps.blog.validators import validate_image
from apps.common.models import TimeStampedModel

VIDEO_EXTENSIONS = ["mp4", "webm"]
AUDIO_EXTENSIONS = ["mp3", "m4a", "aac", "ogg", "oga", "opus", "wav"]
#: nginx برای داشبورد ۱۰۰ مگابایت می‌پذیرد؛ ویدیوی بلندتر با پیوندِ آپارات
MEDIA_MAX_MB = 95


def validate_media_size(file):
    if file and file.size > MEDIA_MAX_MB * 1024 * 1024:
        raise ValidationError(
            f"حجمِ فایل بیشتر از {MEDIA_MAX_MB} مگابایت است؛ ویدیوی بلند را در آپارات بگذارید و پیوندش را بدهید.")


def validate_https(value):
    if value and not value.lower().startswith("https://"):
        raise ValidationError("نشانی باید با https:// شروع شود.")


class Topic(models.TextChoices):
    LEARNING = "learning", "یادگیری و درس"
    HABITS = "habits", "عادت و برنامه‌ی روزانه"
    EMOTIONS = "emotions", "احساسات و رفتار"
    SCREEN = "screen", "بازی و صفحه‌نمایش"
    HEALTH = "health", "خواب و سلامت"
    FAMILY = "family", "خانواده و رابطه"


class LearnItem(TimeStampedModel):
    class Kind(models.TextChoices):
        ARTICLE = "article", "مقاله"
        VIDEO = "video", "ویدیو"
        PODCAST = "podcast", "پادکست"

    class Status(models.TextChoices):
        DRAFT = "draft", "پیش‌نویس"
        PUBLISHED = "published", "منتشرشده"

    kind = models.CharField(max_length=8, choices=Kind.choices, default=Kind.ARTICLE, verbose_name="نوع")
    title = models.CharField(max_length=140, verbose_name="عنوان")
    summary = models.CharField(max_length=300, blank=True, verbose_name="خلاصه",
                               help_text="یکی دو جمله؛ در کارت و پیش‌نمایشِ قفل دیده می‌شود.")
    topic = models.CharField(max_length=10, choices=Topic.choices, default=Topic.LEARNING, db_index=True,
                             verbose_name="موضوع")
    body = models.TextField(blank=True, verbose_name="متن",
                            help_text="متنِ مقاله، یا یادداشتِ ویدیو و پادکست. ## تیتر، **پررنگ**، - فهرست.")
    cover = models.FileField(upload_to="learn/covers/%Y/%m/", blank=True, validators=[validate_image],
                             verbose_name="تصویرِ شاخص")
    media_file = models.FileField(
        upload_to="learn/media/%Y/%m/", blank=True, verbose_name="فایلِ ویدیو یا صدا",
        validators=[FileExtensionValidator([*VIDEO_EXTENSIONS, *AUDIO_EXTENSIONS]), validate_media_size],
        help_text=f"ویدیو MP4 یا WebM، پادکست MP3 یا M4A؛ تا {MEDIA_MAX_MB} مگابایت.")
    media_url = models.URLField(
        blank=True, validators=[validate_https], verbose_name="یا نشانی",
        help_text="ویدیو: پیوندِ آپارات (aparat.com/v/…) یا فایلِ مستقیمِ MP4؛ پادکست: فایلِ مستقیمِ MP3.")
    duration_minutes = models.PositiveSmallIntegerField(
        default=0, verbose_name="مدت (دقیقه)", help_text="مقاله: خالی بماند تا از روی متن حساب شود.")
    author = models.CharField(max_length=60, blank=True, default="تیم آموزشی لوکو", verbose_name="نویسنده یا گوینده")
    premium = models.BooleanField(default=False, verbose_name="ویژه‌ی مشترکان")
    featured = models.BooleanField(default=False, verbose_name="برگزیده (بالای صفحه)")
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.DRAFT, verbose_name="وضعیت")
    published_at = models.DateTimeField(null=True, blank=True, db_index=True, verbose_name="زمانِ انتشار")
    sort = models.PositiveSmallIntegerField(default=0, verbose_name="ترتیب")
    views = models.PositiveIntegerField(default=0, verbose_name="بازدید")

    class Meta:
        verbose_name = "آموزشِ والدین"
        verbose_name_plural = "آموزشِ والدین"
        ordering = ["sort", "-published_at", "-id"]
        indexes = [models.Index(fields=["status", "kind"])]

    def __str__(self):
        return self.title

    def clean(self):
        super().clean()
        name = (self.media_file.name or "").lower() if self.media_file else ""
        ext = name.rsplit(".", 1)[-1] if "." in name else ""
        if self.kind == self.Kind.VIDEO and ext and ext not in VIDEO_EXTENSIONS:
            raise ValidationError({"media_file": "برای ویدیو فایلِ MP4 یا WebM لازم است."})
        if self.kind == self.Kind.PODCAST and ext and ext not in AUDIO_EXTENSIONS:
            raise ValidationError({"media_file": "برای پادکست فایلِ صوتی (MP3، M4A، …) لازم است."})
        if self.status == self.Status.PUBLISHED:
            if self.kind == self.Kind.ARTICLE and not (self.body or "").strip():
                raise ValidationError({"body": "مقاله‌ی منتشرشده متن لازم دارد."})
            if self.kind != self.Kind.ARTICLE and not (self.media_file or self.media_url):
                raise ValidationError({"media_file": "برای انتشار، فایل یا نشانیِ ویدیو/پادکست لازم است."})

    def save(self, *args, **kwargs):
        if self.status == self.Status.PUBLISHED and not self.published_at:
            self.published_at = timezone.now()
        super().save(*args, **kwargs)

    @property
    def is_live(self) -> bool:
        return self.status == self.Status.PUBLISHED and bool(self.published_at) and self.published_at <= timezone.now()


class LearnProgress(TimeStampedModel):
    """ذخیره، تمام‌شدن و جای پخشِ هر محتوا برای هر والد"""

    parent = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="learn_progress",
                               verbose_name="والد")
    item = models.ForeignKey(LearnItem, on_delete=models.CASCADE, related_name="progress", verbose_name="محتوا")
    saved = models.BooleanField(default=False, verbose_name="ذخیره‌شده")
    done = models.BooleanField(default=False, verbose_name="خوانده/دیده شد")
    seconds = models.PositiveIntegerField(default=0, verbose_name="جای پخش (ثانیه)")

    class Meta:
        verbose_name = "پیشرفتِ آموزش"
        verbose_name_plural = "پیشرفتِ آموزش"
        constraints = [models.UniqueConstraint(fields=["parent", "item"], name="learn_progress_parent_item")]

    def __str__(self):
        return f"{self.parent} · {self.item}"
