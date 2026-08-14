from django.contrib import admin

from .models import Podcast, PodcastListen, Recipe, TrafficRule, Video, VideoInteraction


@admin.register(Video)
class VideoAdmin(admin.ModelAdmin):
    list_display = ("title", "category", "duration_minutes", "views", "is_active", "sort")
    list_filter = ("category", "is_active")
    list_editable = ("is_active", "sort")
    search_fields = ("title",)


@admin.register(Podcast)
class PodcastAdmin(admin.ModelAdmin):
    list_display = ("title", "category", "duration_minutes", "is_active", "sort")
    list_filter = ("category", "is_active")
    list_editable = ("is_active", "sort")
    search_fields = ("title",)


@admin.register(TrafficRule)
class TrafficRuleAdmin(admin.ModelAdmin):
    list_display = ("text", "rule_key", "has_game", "is_active", "sort")
    list_filter = ("has_game", "is_active")
    list_editable = ("has_game", "is_active", "sort")


@admin.register(Recipe)
class RecipeAdmin(admin.ModelAdmin):
    list_display = ("name", "recipe_key", "has_game", "is_active", "sort")
    list_filter = ("has_game", "is_active")
    list_editable = ("has_game", "is_active", "sort")


@admin.register(VideoInteraction)
class VideoInteractionAdmin(admin.ModelAdmin):
    list_display = ("user", "video", "liked", "viewed", "created_at")
    list_filter = ("liked", "viewed")


@admin.register(PodcastListen)
class PodcastListenAdmin(admin.ModelAdmin):
    list_display = ("user", "podcast", "seconds", "created_at")
