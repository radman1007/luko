from django.contrib import admin

from apps.common import cache

from .models import DewLogEntry, GardenShopItem, GardenState, Plant


class PlantInline(admin.TabularInline):
    model = Plant
    extra = 0


@admin.register(GardenState)
class GardenStateAdmin(admin.ModelAdmin):
    list_display = ("user", "dew", "fertilizer", "seeds", "plot_level", "season")
    list_filter = ("season", "plot_level")
    search_fields = ("user__phone",)
    inlines = [PlantInline]


@admin.register(GardenShopItem)
class GardenShopItemAdmin(admin.ModelAdmin):
    list_display = ("title", "item_key", "kind", "cost", "amount", "is_active", "sort")
    list_editable = ("cost", "amount", "is_active", "sort")
    list_filter = ("kind", "is_active")
    search_fields = ("title", "item_key")

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        cache.invalidate_catalog("garden_shop")  # فروشگاه پس از تغییر تازه شود

    def delete_model(self, request, obj):
        super().delete_model(request, obj)
        cache.invalidate_catalog("garden_shop")


@admin.register(DewLogEntry)
class DewLogEntryAdmin(admin.ModelAdmin):
    list_display = ("user", "amount", "source", "created_at")
    list_filter = ("source",)
