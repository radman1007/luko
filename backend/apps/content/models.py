"""
محتوای ادمین‌ویرایش‌پذیر: ویدیوهای لوکو تلویزیون، پادکست‌ها،
قانونِ روزِ جاده و خوراکیِ روز. همه از پنل ادمین اضافه/ویرایش می‌شوند.
"""
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import FileExtensionValidator
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


#: قالب‌هایی که مرورگرِ گوشی و تبلت پخش می‌کند
PODCAST_AUDIO_EXTENSIONS = ["mp3", "m4a", "aac", "ogg", "oga", "opus", "wav"]
#: سقفِ فایلِ صوتی؛ nginx برای مسیرِ ادمین کمی بیشتر می‌پذیرد تا این پیام دیده شود نه خطای ۴۱۳
PODCAST_MAX_MB = 80


def validate_https_audio_url(value):
    # صفحه‌ی https فایلِ http را پخش نمی‌کند (محتوای مختلط)
    if value and not value.lower().startswith("https://"):
        raise ValidationError("نشانی باید با https:// شروع شود؛ مرورگر فایلِ http را پخش نمی‌کند.")


def validate_podcast_audio_size(file):
    if file and file.size > PODCAST_MAX_MB * 1024 * 1024:
        raise ValidationError(
            f"حجمِ فایل بیشتر از {PODCAST_MAX_MB} مگابایت است؛ با کیفیتِ ۹۶ تا ۱۲۸ کیلوبیت MP3 بگیرید."
        )


class Podcast(ContentBase):
    """قسمتِ پادکست: فایلِ صوتی از همین پنل بارگذاری می‌شود (یا نشانیِ یک فایلِ بیرونی)."""

    #: پیشنهادهای فیلدِ دسته در ادمین؛ دسته آزاد است (مثلاً «مشاهیر ایرانی») و دکمه‌های
    #: دسته در سایت از خودِ قسمت‌ها ساخته می‌شوند
    SUGGESTED_CATEGORIES = ["قصه", "علمی", "موسیقی", "خواب"]

    # همان نام‌هایی که فرانت به آیکون تبدیل می‌کند (features/podcast/icons.ts)
    class Icon(models.TextChoices):
        ROCKET = "HiOutlineRocketLaunch", "موشک"
        CLOUD = "HiOutlineCloud", "ابر"
        MOON = "HiOutlineMoon", "ماه"
        STAR = "HiOutlineStar", "ستاره"
        SUN = "HiOutlineSun", "خورشید"
        MUSIC = "HiOutlineMusicalNote", "نُتِ موسیقی"
        BUG = "HiOutlineBugAnt", "حشره / دایناسور"
        GLOBE = "HiOutlineGlobeAsiaAustralia", "زمین"
        BOOK = "HiOutlineBookOpen", "کتاب"
        SPARKLES = "HiOutlineSparkles", "جادو"
        HEART = "HiOutlineHeart", "قلب"
        MIC = "HiOutlineMicrophone", "میکروفون"

    category = models.CharField(max_length=30, db_index=True, verbose_name="دسته",
                                help_text="یکی از پیشنهادها یا دسته‌ی تازه؛ در سایت دکمه‌ی همین دسته ساخته می‌شود.")
    icon = models.CharField(max_length=40, blank=True, choices=Icon.choices,
                            verbose_name="آیکون",
                            help_text="خالی بماند، آیکونِ دسته نشان داده می‌شود.")
    duration_minutes = models.PositiveSmallIntegerField(
        default=0, verbose_name="مدت (دقیقه)",
        help_text="با انتخابِ فایل خودش پر می‌شود؛ در پخش، مدتِ واقعیِ فایل ملاک است.")
    audio_file = models.FileField(
        upload_to="podcasts/%Y/%m/", blank=True, verbose_name="فایل صوتی",
        validators=[FileExtensionValidator(PODCAST_AUDIO_EXTENSIONS), validate_podcast_audio_size],
        help_text=f"MP3 بهترین است. تا {PODCAST_MAX_MB} مگابایت.")
    audio_url = models.URLField(
        blank=True, verbose_name="یا نشانیِ فایلِ صوتی", validators=[validate_https_audio_url],
        help_text="فقط اگر فایل جای دیگری است: نشانیِ مستقیمِ خودِ فایل با https "
                  "(مثلاً …/episode.mp3)، نه صفحه‌ای که فایل در آن است.")

    class Meta:
        verbose_name = "پادکست"
        verbose_name_plural = "پادکست‌ها"
        ordering = ["sort", "-created_at"]

    # «فایل یا نشانی لازم است» در فرمِ ادمین چک می‌شود (PodcastAdminForm)، نه این‌جا:
    # خطای Model.clean روی فیلدی که در فرمِ ویرایشِ فهرست نیست، ValueError (۵۰۰) می‌دهد.

    @property
    def has_audio(self) -> bool:
        return bool(self.audio_file or self.audio_url)



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
