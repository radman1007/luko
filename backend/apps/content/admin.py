from django.contrib import admin

from apps.common.admin_helpers import ReadOnlyAdmin, jalali
from apps.common.fa import fa_digits

from .models import Podcast, PodcastListen, Recipe, TrafficRule, Video, VideoInteraction


@admin.register(Video)
class VideoAdmin(admin.ModelAdmin):
    """ویدیوهای لوکو تلویزیون. «تعداد بازدید» را سرور می‌شمارد."""

    list_display = ("title", "category", "duration_minutes", "shown_views",
                    "likes", "is_active", "sort")
    list_filter = ("category", "is_active")
    list_editable = ("is_active", "sort")
    search_fields = ("title",)
    ordering = ("sort", "-created_at")

    @admin.display(description="تعداد بازدید", ordering="views")
    def shown_views(self, obj):
        return fa_digits(obj.views)

    @admin.display(description="پسند")
    def likes(self, obj):
        return fa_digits(obj.interactions.filter(liked=True).count())


@admin.register(Podcast)
class PodcastAdmin(admin.ModelAdmin):
    list_display = ("title", "category", "duration_minutes", "listens", "is_active", "sort")
    list_filter = ("category", "is_active")
    list_editable = ("is_active", "sort")
    search_fields = ("title",)
    ordering = ("sort", "-created_at")

    @admin.display(description="تعداد گوش‌دادن")
    def listens(self, obj):
        return fa_digits(obj.listens.count())


@admin.register(TrafficRule)
class TrafficRuleAdmin(admin.ModelAdmin):
    """قانونِ روزِ جاده — هر روز یکی از ردیف‌های فعال نشان داده می‌شود."""

    list_display = ("text", "rule_key", "has_game", "is_active", "sort")
    list_filter = ("has_game", "is_active")
    list_editable = ("has_game", "is_active", "sort")
    search_fields = ("text", "rule_key")
    ordering = ("sort", "id")


@admin.register(Recipe)
class RecipeAdmin(admin.ModelAdmin):
    """خوراکیِ روزِ سرآشپز زعفران."""

    list_display = ("name", "recipe_key", "item_count", "has_game", "is_active", "sort")
    list_filter = ("has_game", "is_active")
    list_editable = ("has_game", "is_active", "sort")
    search_fields = ("name", "recipe_key")
    ordering = ("sort", "id")

    @admin.display(description="تعداد ماده")
    def item_count(self, obj):
        return fa_digits(len(obj.ingredients or []))


@admin.register(VideoInteraction)
class VideoInteractionAdmin(ReadOnlyAdmin):
    """بازدید و پسندِ بچه‌ها روی ویدیوها."""

    list_display = ("user", "phone", "video", "liked", "viewed", "at")
    list_filter = ("liked", "viewed")
    search_fields = ("user__phone", "video__title")
    list_select_related = ("user", "video")
    list_per_page = 50

    at = jalali("created_at", "زمان")

    @admin.display(description="شماره", ordering="user__phone")
    def phone(self, obj):
        return fa_digits(obj.user.phone)


@admin.register(PodcastListen)
class PodcastListenAdmin(ReadOnlyAdmin):
    list_display = ("user", "phone", "podcast", "shown_seconds", "at")
    search_fields = ("user__phone", "podcast__title")
    list_select_related = ("user", "podcast")
    date_hierarchy = "created_at"
    list_per_page = 50

    at = jalali("created_at", "زمان")

    @admin.display(description="شماره", ordering="user__phone")
    def phone(self, obj):
        return fa_digits(obj.user.phone)

    @admin.display(description="مدت", ordering="seconds")
    def shown_seconds(self, obj):
        return fa_digits(f"{obj.seconds} ثانیه")
