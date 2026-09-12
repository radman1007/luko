from django.contrib import admin

from apps.common import cache
from apps.common.admin_helpers import ReadOnlyAdmin, jalali
from apps.common.fa import fa_digits

from .models import DewLogEntry, GardenShopItem, GardenState, Plant


class PlantInline(admin.TabularInline):
    model = Plant
    extra = 0
    fields = ("kind", "care", "planted_at")
    readonly_fields = ("planted_at",)
    verbose_name = "گیاه"
    verbose_name_plural = "گیاهانِ این باغچه"


@admin.register(GardenState)
class GardenStateAdmin(admin.ModelAdmin):
    """
    باغچه‌ی هر بچه.

    شبنم و کود و دانه را سرور می‌دهد، ولی ویرایش این‌جا باز است چون گاهی
    پشتیبانی باید چیزی را که به‌خاطرِ خطا کم شده برگرداند.
    """

    list_display = ("user", "phone", "shown_dew", "fertilizer", "seeds",
                    "plot_level", "plant_count", "season")
    list_filter = ("season", "plot_level")
    search_fields = ("user__phone", "user__first_name")
    list_select_related = ("user",)
    inlines = [PlantInline]
    list_per_page = 50

    @admin.display(description="شماره", ordering="user__phone")
    def phone(self, obj):
        return fa_digits(obj.user.phone)

    @admin.display(description="شبنم", ordering="dew")
    def shown_dew(self, obj):
        return fa_digits(obj.dew)

    @admin.display(description="تعداد گیاه")
    def plant_count(self, obj):
        return fa_digits(obj.plants.count())


@admin.register(GardenShopItem)
class GardenShopItemAdmin(admin.ModelAdmin):
    """فروشگاهِ باغچه — از همین‌جا کالا اضافه و قیمت‌گذاری می‌شود."""

    list_display = ("title", "item_key", "kind", "cost", "amount", "is_active", "sort")
    list_editable = ("cost", "amount", "is_active", "sort")
    list_filter = ("kind", "is_active")
    search_fields = ("title", "item_key")
    ordering = ("sort", "id")

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        cache.invalidate_catalog("garden_shop")  # فروشگاه پس از تغییر تازه شود

    def delete_model(self, request, obj):
        super().delete_model(request, obj)
        cache.invalidate_catalog("garden_shop")

    def delete_queryset(self, request, queryset):
        """حذفِ گروهی هم باید کش را تازه کند، وگرنه کالای پاک‌شده تا یک ساعت می‌ماند."""
        super().delete_queryset(request, queryset)
        cache.invalidate_catalog("garden_shop")


@admin.register(DewLogEntry)
class DewLogEntryAdmin(ReadOnlyAdmin):
    """دفترچه‌ی شبنم — از کجا آمده و کجا رفته."""

    list_display = ("user", "phone", "shown_amount", "source", "at")
    list_filter = ("source",)
    search_fields = ("user__phone", "user__first_name")
    list_select_related = ("user",)
    date_hierarchy = "created_at"
    list_per_page = 50

    at = jalali("created_at", "زمان")

    @admin.display(description="شماره", ordering="user__phone")
    def phone(self, obj):
        return fa_digits(obj.user.phone)

    @admin.display(description="مقدار", ordering="amount")
    def shown_amount(self, obj):
        sign = "+" if obj.amount >= 0 else "−"
        return fa_digits(f"{sign}{abs(obj.amount)}")
