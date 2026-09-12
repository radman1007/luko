from django.contrib import admin

from apps.common.admin_helpers import ReadOnlyAdmin, jalali
from apps.common.fa import fa_digits

from .models import DailyAssignment, Notification, ParentChild, ParentPreference


@admin.register(ParentChild)
class ParentChildAdmin(admin.ModelAdmin):
    """
    پیوندِ خانواده — همه‌ی دسترسیِ پنلِ والدین از روی همین جدول داده می‌شود.

    اگر گزارشی به والدی نمی‌رسد یا فرزندی در پنلش دیده نمی‌شود، اول این‌جا
    باید نگاه کرد.
    """

    list_display = ("parent", "parent_phone", "child", "child_phone", "relation",
                    "grade", "school", "is_active")
    list_filter = ("relation", "grade", "is_active")
    search_fields = ("parent__phone", "child__phone", "child__first_name",
                     "parent__first_name")
    list_select_related = ("parent", "child")
    autocomplete_fields = ("parent", "child")
    list_per_page = 50

    @admin.display(description="شماره والد", ordering="parent__phone")
    def parent_phone(self, obj):
        return fa_digits(obj.parent.phone)

    @admin.display(description="شماره فرزند", ordering="child__phone")
    def child_phone(self, obj):
        return fa_digits(obj.child.phone)


@admin.register(DailyAssignment)
class DailyAssignmentAdmin(admin.ModelAdmin):
    """«بازیِ روز»ی که والد برای فرزندش انتخاب کرده."""

    list_display = ("child", "game_slug", "when", "assigned_by", "note")
    list_filter = ("date",)
    search_fields = ("child__phone", "child__first_name", "game_slug")
    list_select_related = ("child", "assigned_by")
    autocomplete_fields = ("child", "assigned_by")
    date_hierarchy = "date"
    list_per_page = 50

    when = jalali("date", "تاریخ", with_time=False)


@admin.register(ParentPreference)
class ParentPreferenceAdmin(admin.ModelAdmin):
    list_display = ("parent", "weekly_report", "activity_alerts")
    list_filter = ("weekly_report", "activity_alerts")
    search_fields = ("parent__phone", "parent__first_name")
    list_select_related = ("parent",)


@admin.register(Notification)
class NotificationAdmin(ReadOnlyAdmin):
    """
    اعلان‌های والد.

    ردیف‌ها را سرور از دادهٔ واقعی می‌سازد، نه دست؛ ساختنِ دستی‌شان اعلانی
    می‌داد که پشتش هیچ اتفاقی نیفتاده. پس فقط دیده می‌شوند.
    """

    list_display = ("user", "kind", "title", "child", "is_read", "sent")
    list_filter = ("kind", "is_read")
    search_fields = ("user__phone", "title", "child__phone")
    list_select_related = ("user", "child")
    list_per_page = 50

    sent = jalali("created_at", "زمان")
