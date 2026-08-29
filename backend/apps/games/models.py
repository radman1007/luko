from django.conf import settings
from django.db import models

from apps.common.models import TimeStampedModel


class Book(TimeStampedModel):
    """
    کتابِ درسی (دنیای بازی‌ها). `book_id` همان شناسه‌ی فرانت است (مثل `math-1`)
    و بازی‌ها با همین رشته به کتاب وصل می‌شوند.
    """

    book_id = models.SlugField(max_length=60, unique=True)
    title = models.CharField(max_length=120)
    subject = models.CharField(max_length=40)                 # ریاضی، علوم، ...
    grade = models.PositiveSmallIntegerField(default=1)
    world_title = models.CharField(max_length=120, blank=True)
    icon = models.CharField(max_length=40, blank=True)
    is_active = models.BooleanField(default=True)
    sort = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["grade", "sort", "id"]

    def __str__(self):
        return f"{self.title} ({self.book_id})"


class Game(TimeStampedModel):
    """
    کاتالوگِ بازی‌های آموزشی (مراحلِ کتاب‌ها). slug همان levelId فرانت است
    (مثل `grade-1-3`). پاداش‌ها اینجا تعریف می‌شوند تا سمت سرور معتبر باشند.
    """

    slug = models.SlugField(max_length=80, unique=True)
    title = models.CharField(max_length=120)
    book_id = models.CharField(max_length=60, blank=True, db_index=True)
    order = models.PositiveIntegerField(default=0)
    # جایگاه در مسیرِ سیزن — یک صفِ واحد روی همه‌ی کتاب‌ها، از پیشوندِ عددیِ
    # نامِ فایل. ۰ یعنی این بازی روی مسیر نیست و ترتیبی برایش شرط نمی‌شود.
    season_order = models.PositiveIntegerField(default=0, db_index=True)
    # مسیرِ عمومیِ فایلِ بازی (`/games/grade-1/math/01-....html`). سرور برای
    # ساختنِ لینکِ امضاشده لازمش دارد؛ خالی یعنی بازی هنوز نرسیده است.
    game_file = models.CharField(max_length=200, blank=True)
    coin_reward = models.PositiveIntegerField(default=10)
    dew_reward = models.PositiveIntegerField(default=6)       # شبنمِ باغچه
    fertilizer_reward = models.PositiveIntegerField(default=1)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["book_id", "order"]

    def __str__(self):
        return self.slug


class GameCompletion(TimeStampedModel):
    """تکمیلِ یک بازی توسط کاربر — یک بار پاداش می‌دهد (unique)."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                             related_name="game_completions")
    game_slug = models.SlugField(max_length=80, db_index=True)
    coins_awarded = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = ("user", "game_slug")
        indexes = [models.Index(fields=["user", "game_slug"])]

    def __str__(self):
        return f"{self.user} ✓ {self.game_slug}"


class GameEvent(TimeStampedModel):
    """
    رویدادهای داخل بازی برای تحلیلِ آینده (با LLM خودمان): شروع، پایان، خطا،
    زمان، امتیاز و... . payload به‌صورت JSONB نگه داشته می‌شود.
    """

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                             related_name="game_events")
    game_slug = models.SlugField(max_length=80, db_index=True)
    event_type = models.CharField(max_length=40, db_index=True)
    payload = models.JSONField(default=dict, blank=True)

    class Meta:
        indexes = [models.Index(fields=["user", "created_at"])]

    def __str__(self):
        return f"{self.game_slug}:{self.event_type}"


# باطل‌سازیِ کشِ کاتالوگ. بدونِ این، ویرایشِ ادمین تا یک ساعت دیده نمی‌شد.
def _drop_catalog_cache(*args, **kwargs) -> None:
    from apps.common import cache
    keys = [cache.book_catalog_key(None)]
    keys += [cache.book_catalog_key(str(g)) for g in range(1, 7)]
    cache.invalidate(*keys)


models.signals.post_save.connect(_drop_catalog_cache, sender=Book)
models.signals.post_delete.connect(_drop_catalog_cache, sender=Book)
models.signals.post_save.connect(_drop_catalog_cache, sender=Game)
models.signals.post_delete.connect(_drop_catalog_cache, sender=Game)
