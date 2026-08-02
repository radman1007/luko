from django.contrib import admin

from .models import Game, GameCompletion, GameEvent


@admin.register(Game)
class GameAdmin(admin.ModelAdmin):
    list_display = ("slug", "title", "book_id", "order", "coin_reward",
                    "dew_reward", "is_active")
    list_filter = ("book_id", "is_active")
    search_fields = ("slug", "title")
    list_editable = ("coin_reward", "dew_reward", "is_active")


@admin.register(GameCompletion)
class GameCompletionAdmin(admin.ModelAdmin):
    list_display = ("user", "game_slug", "coins_awarded", "created_at")
    search_fields = ("user__phone", "game_slug")
    list_filter = ("created_at",)


@admin.register(GameEvent)
class GameEventAdmin(admin.ModelAdmin):
    list_display = ("user", "game_slug", "event_type", "created_at")
    list_filter = ("event_type", "created_at")
    search_fields = ("user__phone", "game_slug")
