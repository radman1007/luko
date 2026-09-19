from django.conf import settings
from django.db import models

from apps.common.constants import GRADE_CHOICES
from apps.common.models import TimeStampedModel


class Book(TimeStampedModel):
    """
    کتابِ درسی (دنیای بازی‌ها). `book_id` همان شناسه‌ی فرانت است (مثل `math-1`)
    و بازی‌ها با همین رشته به کتاب وصل می‌شوند.
    """

    book_id = models.SlugField(max_length=60, unique=True, verbose_name="شناسه کتاب")
    title = models.CharField(max_length=120, verbose_name="عنوان")
    # ریاضی، علوم، ...
    subject = models.CharField(max_length=40, verbose_name="درس")
    grade = models.PositiveSmallIntegerField(default=1, choices=GRADE_CHOICES,
                                             verbose_name="پایه تحصیلی")
    world_title = models.CharField(max_length=120, blank=True, verbose_name="نام دنیا")
    icon = models.CharField(max_length=40, blank=True, verbose_name="آیکون")
    is_active = models.BooleanField(default=True, verbose_name="فعال")
    sort = models.PositiveSmallIntegerField(default=0, verbose_name="ترتیب نمایش")

    class Meta:
        verbose_name = "کتاب درسی"
        verbose_name_plural = "کتاب‌های درسی"
        ordering = ["grade", "sort", "id"]

    def __str__(self):
        return f"{self.title} ({self.book_id})"


class GameQuerySet(models.QuerySet):
    def playable(self):
        """بازی‌هایی که روی مسیرند و بچه می‌تواند بازی‌شان کند."""
        return self.filter(status=Game.Status.READY, is_active=True)


class Game(TimeStampedModel):
    """
    کاتالوگِ بازی‌ها.

    ردیف‌ها دستی ساخته نمی‌شوند: `python manage.py sync_games` آن‌ها را از
    نامِ فایل‌ها (`C1-Kr-F1-S2-G2.html`) می‌سازد و جایگاهشان را حساب می‌کند
    (`apps/games/registry.py`). جایگاه و فایل مالِ همگام‌سازی است؛ عنوان،
    پاداش‌ها و «فعال» مالِ ادمین و همگام‌سازی به آن‌ها دست نمی‌زند.

    `slug` هویتِ پایدارِ بازی است و پیشرفتِ بچه‌ها به آن بسته است؛ با
    تغییرِ نامِ فایل عوض نمی‌شود و معنایی ندارد تا چیزی از درس لو ندهد.
    """

    class Status(models.TextChoices):
        READY = "ready", "روی مسیر"
        INVALID = "invalid", "نام فایل نامعتبر"
        CONFLICT = "conflict", "جایگاه تکراری"
        MISSING = "missing", "فایل حذف شده"

    slug = models.SlugField(max_length=80, unique=True, verbose_name="شناسه بازی")
    title = models.CharField(max_length=120, verbose_name="عنوان")
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.READY,
                              db_index=True, verbose_name="وضعیت")
    # یادداشتِ همگام‌سازی: چرا روی مسیر نیامد (نامِ غلط، جایگاهِ تکراری، …)
    review_note = models.TextField(blank=True, verbose_name="یادداشت بررسی")

    # ---- جایگاه، از نامِ فایل (C-K-F-S-G) ----
    grade = models.PositiveSmallIntegerField(default=1, choices=GRADE_CHOICES,
                                             db_index=True, verbose_name="کلاس (C)")
    # فقط داخلی: هیچ‌وقت به بچه فرستاده نمی‌شود
    book_code = models.CharField(max_length=4, blank=True, verbose_name="کد کتاب (K)")
    chapter = models.PositiveSmallIntegerField(default=0, verbose_name="فصل یا ماه (F)")
    week = models.PositiveSmallIntegerField(default=0, verbose_name="سیزن یا هفته (S)")
    number = models.PositiveSmallIntegerField(default=0, verbose_name="شماره بازی (G)")
    book_id = models.CharField(max_length=60, blank=True, db_index=True,
                               verbose_name="شناسه کتاب")
    order = models.PositiveIntegerField(default=0, verbose_name="ترتیب در کتاب")
    # جایگاه در مسیرِ همان کلاس (۱، ۲، …) — از (F, S, G) حساب می‌شود.
    # ۰ یعنی روی مسیر نیست.
    season_order = models.PositiveIntegerField(default=0, db_index=True,
                                               verbose_name="ترتیب در مسیر سیزن")

    # ---- فایل ----
    # مسیرِ عمومیِ فایل (`/games/C1-Kr-F1-S1-G1.html`). سرور برای ساختنِ
    # لینکِ امضاشده لازمش دارد.
    game_file = models.CharField(max_length=200, blank=True, verbose_name="مسیر فایل بازی")
    # sha256ِ محتوا: فایلی که فقط تغییرِ نام داده با همین شناخته می‌شود
    content_hash = models.CharField(max_length=64, blank=True, db_index=True,
                                    verbose_name="اثر انگشت فایل")

    # ---- مالِ ادمین ----
    # سقفِ ستاره‌ی این بازی. روی مدل است نه ثابتِ کد، چون بازیِ کوتاه
    # ممکن است بعداً دو ستاره‌ای تعریف شود و مجموعِ سیزن باید درست بماند.
    max_stars = models.PositiveSmallIntegerField(default=3, verbose_name="بیشترین ستاره")
    coin_reward = models.PositiveIntegerField(default=10, verbose_name="پاداش سکه")
    dew_reward = models.PositiveIntegerField(default=6, verbose_name="پاداش شبنم")
    fertilizer_reward = models.PositiveIntegerField(default=1, verbose_name="پاداش کود")
    is_active = models.BooleanField(default=True, verbose_name="فعال")

    objects = GameQuerySet.as_manager()

    class Meta:
        verbose_name = "بازی"
        verbose_name_plural = "بازی‌ها"
        ordering = ["grade", "season_order", "id"]

    def __str__(self):
        return self.title or self.slug

    @property
    def code(self) -> str:
        """کدِ فایل (`C1-Kr-F1-S2-G2`) — فقط برای ادمین."""
        if not (self.chapter and self.week and self.number):
            return ""
        return (f"C{self.grade}-K{self.book_code}-F{self.chapter}"
                f"-S{self.week}-G{self.number}")


class GameCompletion(TimeStampedModel):
    """تکمیلِ یک بازی توسط کاربر — یک بار پاداش می‌دهد (unique)."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                             related_name="game_completions", verbose_name="کاربر")
    game_slug = models.SlugField(max_length=80, db_index=True, verbose_name="شناسه بازی")
    coins_awarded = models.PositiveIntegerField(default=0, verbose_name="سکه داده‌شده")
    # بهترین ستاره‌ای که تا حالا گرفته — نه آخرین. بچه برای بالا بردنش
    # دوباره بازی می‌کند و یک اجرای بد نباید دستاوردش را پس بگیرد.
    # ۰ یعنی بازی تمام شده ولی هنوز ستاره‌ای ثبت نشده.
    stars = models.PositiveSmallIntegerField(default=0, verbose_name="بهترین ستاره")

    class Meta:
        verbose_name = "بازی تمام‌شده"
        verbose_name_plural = "بازی‌های تمام‌شده"
        unique_together = ("user", "game_slug")
        indexes = [models.Index(fields=["user", "game_slug"])]

    def __str__(self):
        return f"{self.user} ✓ {self.game_slug}"


class SeasonMemory(TimeStampedModel):
    """
    عکسِ یادگاریِ بچه از یک نقطه‌ی نقشه‌ی سیزن.

    همان الگوی `health.Painting`: تصویر در دیتابیس می‌ماند و فقط از راهِ
    APIِ احرازشده برمی‌گردد — عکسِ بچه شخصی است و نباید با یک URLِ
    حدس‌زدنی از بیرون دیده شود. بندانگشتی جدا نگه داشته می‌شود تا نقشه
    سبک بماند و تصویرِ کامل فقط وقتی بیاید که خودش بازش کند.
    """

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                             related_name="season_memories", verbose_name="کاربر")
    season_id = models.SlugField(max_length=40, db_index=True, verbose_name="شناسه سیزن")
    spot_id = models.SlugField(max_length=40, verbose_name="شناسه نقطه")
    # بندانگشتیِ JPEG (data URL)
    thumbnail = models.TextField(blank=True, verbose_name="بندانگشتی")
    # تصویرِ کامل (data URL)
    image = models.TextField(blank=True, verbose_name="تصویر کامل")

    class Meta:
        verbose_name = "یادگاری سیزن"
        verbose_name_plural = "یادگاری‌های سیزن"
        ordering = ["-created_at"]
        # هر نقطه یک یادگاری؛ عکسِ تازه جای قبلی را می‌گیرد
        constraints = [
            models.UniqueConstraint(fields=["user", "season_id", "spot_id"],
                                    name="uniq_memory_per_spot"),
        ]

    def __str__(self):
        return f"Memory<{self.user}:{self.season_id}/{self.spot_id}>"


class GameEvent(TimeStampedModel):
    """
    رویدادهای داخل بازی برای تحلیلِ آینده (با LLM خودمان): شروع، پایان، خطا،
    زمان، امتیاز و... . payload به‌صورت JSONB نگه داشته می‌شود.
    """

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                             related_name="game_events", verbose_name="کاربر")
    game_slug = models.SlugField(max_length=80, db_index=True, verbose_name="شناسه بازی")
    event_type = models.CharField(max_length=40, db_index=True, verbose_name="نوع رویداد")
    payload = models.JSONField(default=dict, blank=True, verbose_name="داده رویداد")

    class Meta:
        verbose_name = "رویداد بازی"
        verbose_name_plural = "رویدادهای بازی"
        indexes = [models.Index(fields=["user", "created_at"])]

    def __str__(self):
        return f"{self.game_slug}:{self.event_type}"


# باطل‌سازیِ کشِ کاتالوگ و مسیر. بدونِ این، ویرایشِ ادمین تا یک ساعت دیده نمی‌شد.
def _drop_catalog_cache(*args, **kwargs) -> None:
    from .registry import drop_caches
    drop_caches()


models.signals.post_save.connect(_drop_catalog_cache, sender=Book)
models.signals.post_delete.connect(_drop_catalog_cache, sender=Book)
models.signals.post_save.connect(_drop_catalog_cache, sender=Game)
models.signals.post_delete.connect(_drop_catalog_cache, sender=Game)
