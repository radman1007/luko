from django.contrib import admin

from apps.common.admin_helpers import ReadOnlyAdmin, jalali
from apps.common.fa import fa_digits

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
    """
    قالب‌های مأموریت و تسکِ ورزشی.

    «ثابتِ هر روز» یعنی برای همه‌ی بچه‌ها هر روز می‌آید؛ بقیه باید با
    «مأموریت واگذارشده» به بچه‌ی مشخصی داده شوند.
    """

    list_display = ("title", "category", "coin_reward", "is_fixed", "is_suggested",
                    "is_active", "sort")
    list_editable = ("coin_reward", "is_fixed", "is_active", "sort")
    list_filter = ("category", "is_fixed", "is_suggested", "is_active")
    search_fields = ("title",)
    ordering = ("sort", "id")


@admin.register(MissionAssignment)
class MissionAssignmentAdmin(admin.ModelAdmin):
    """واگذاریِ یک قالب به بچه‌ی مشخص. تاریخِ خالی یعنی «هر روز، تا وقتی فعال است»."""

    list_display = ("template", "child", "phone", "when", "created_by", "is_active")
    list_filter = ("is_active", "date")
    search_fields = ("child__phone", "child__first_name", "template__title")
    autocomplete_fields = ("template", "child", "created_by")
    list_select_related = ("template", "child", "created_by")
    list_per_page = 50

    @admin.display(description="شماره فرزند", ordering="child__phone")
    def phone(self, obj):
        return fa_digits(obj.child.phone)

    @admin.display(description="تاریخ", ordering="date")
    def when(self, obj):
        from apps.common.fa import fa_date
        return fa_date(obj.date, with_year=True) if obj.date else "هر روز"


@admin.register(MissionCompletion)
class MissionCompletionAdmin(ReadOnlyAdmin):
    """مأموریت‌های انجام‌شده — تاریخچه‌ی پاداش‌هاست، پس دست‌کاری نمی‌شود."""

    list_display = ("user", "phone", "template", "day_", "coins_awarded")
    search_fields = ("user__phone", "user__first_name", "template__title")
    list_select_related = ("user", "template")
    date_hierarchy = "day"
    list_per_page = 50

    day_ = jalali("day", "روز", with_time=False)

    @admin.display(description="شماره", ordering="user__phone")
    def phone(self, obj):
        return fa_digits(obj.user.phone)


@admin.register(Medal)
class MedalAdmin(admin.ModelAdmin):
    """
    مدال‌ها.

    «شرط گرفتن» و «حد نصاب» با هم معنا می‌دهند: مثلاً شرطِ «روزهای پیاپی»
    با حد نصابِ ۷ یعنی هفت روز پشتِ‌هم.
    """

    list_display = ("title", "key", "criteria", "threshold", "is_active", "sort")
    list_editable = ("criteria", "threshold", "is_active", "sort")
    list_filter = ("criteria", "is_active")
    search_fields = ("title", "key")
    ordering = ("sort", "id")


@admin.register(ShopItem)
class ShopItemAdmin(admin.ModelAdmin):
    """جایزه‌های فروشگاهِ کلاب — قیمت به سکه."""

    list_display = ("title", "item_key", "cost", "sold", "is_active", "sort")
    list_editable = ("cost", "is_active", "sort")
    list_filter = ("is_active",)
    search_fields = ("title", "item_key")
    ordering = ("sort", "id")

    @admin.display(description="تعداد خرید")
    def sold(self, obj):
        return fa_digits(obj.purchases.count())


@admin.register(Purchase)
class PurchaseAdmin(ReadOnlyAdmin):
    """خریدهای انجام‌شده — سکه‌اش کم شده، پس ردیفش تاریخچه است."""

    list_display = ("user", "phone", "item", "at")
    search_fields = ("user__phone", "user__first_name", "item__title")
    list_select_related = ("user", "item")
    date_hierarchy = "created_at"
    list_per_page = 50

    at = jalali("created_at", "زمان")

    @admin.display(description="شماره", ordering="user__phone")
    def phone(self, obj):
        return fa_digits(obj.user.phone)
