from django.conf import settings
from django.db import models

from apps.common.models import TimeStampedModel


class Game(TimeStampedModel):
    """
    کاتالوگِ بازی‌های آموزشی (مراحلِ کتاب‌ها). slug همان levelId فرانت است
    (مثل `grade-1-3`). پاداش‌ها اینجا تعریف می‌شوند تا سمت سرور معتبر باشند.
    """

    slug = models.SlugField(max_length=80, unique=True)
    title = models.CharField(max_length=120)
    book_id = models.CharField(max_length=60, blank=True, db_index=True)
    order = models.PositiveIntegerField(default=0)
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
