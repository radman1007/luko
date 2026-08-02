from django.contrib import admin

from .models import (
    Medal,
    MissionAssignment,
    MissionCompletion,
    MissionTemplate,
    Purchase,
    ShopItem,
)


@admin.register(MissionTemplate)
class MissionTemplateAdmin(admin.ModelAdmin):
    list_display = ("title", "category", "coin_reward", "is_fixed", "is_suggested",
                    "is_active", "sort")
    list_editable = ("coin_reward", "is_fixed", "is_active", "sort")
    list_filter = ("category", "is_fixed", "is_suggested", "is_active")
    search_fields = ("title",)


@admin.register(MissionAssignment)
class MissionAssignmentAdmin(admin.ModelAdmin):
    list_display = ("template", "child", "date", "created_by", "is_active")
    list_filter = ("is_active", "date")
    search_fields = ("child__phone", "template__title")
    autocomplete_fields = ("template", "child", "created_by")


@admin.register(MissionCompletion)
class MissionCompletionAdmin(admin.ModelAdmin):
    list_display = ("user", "template", "day", "coins_awarded")
    list_filter = ("day",)
    search_fields = ("user__phone",)


@admin.register(Medal)
class MedalAdmin(admin.ModelAdmin):
    list_display = ("title", "key", "criteria", "threshold", "is_active", "sort")
    list_editable = ("criteria", "threshold", "is_active", "sort")
    search_fields = ("title", "key")


@admin.register(ShopItem)
class ShopItemAdmin(admin.ModelAdmin):
    list_display = ("title", "item_key", "cost", "is_active", "sort")
    list_editable = ("cost", "is_active", "sort")
    search_fields = ("title", "item_key")


@admin.register(Purchase)
class PurchaseAdmin(admin.ModelAdmin):
    list_display = ("user", "item", "created_at")
    search_fields = ("user__phone", "item__title")
