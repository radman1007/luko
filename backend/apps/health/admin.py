from django.contrib import admin
from django.utils.html import format_html

from apps.common.admin_helpers import ReadOnlyAdmin, jalali
from apps.common.fa import fa_digits

from .models import BreathingSession, MoodCheckin, Painting, Secret


class PhoneColumn:
    """ستونِ شماره — در هر چهار جدولِ این اپ تکرار می‌شد."""

    @admin.display(description="شماره", ordering="user__phone")
    def phone(self, obj):
        return fa_digits(obj.user.phone)


@admin.register(MoodCheckin)
class MoodCheckinAdmin(PhoneColumn, ReadOnlyAdmin):
    """ثبتِ حالِ دلِ بچه‌ها — گزارشِ چیزی که خودشان زده‌اند."""

    list_display = ("user", "phone", "mood", "at")
    list_filter = ("mood",)
    search_fields = ("user__phone", "user__first_name")
    list_select_related = ("user",)
    date_hierarchy = "created_at"
    list_per_page = 50

    at = jalali("created_at", "زمان")


@admin.register(Painting)
class PaintingAdmin(PhoneColumn, ReadOnlyAdmin):
    """
    نقاشی‌های بچه‌ها.

    بندانگشتی نشان داده می‌شود چون بدونِ آن ردیف‌ها از هم قابلِ تشخیص
    نیستند؛ ولی تصویرِ کامل عمداً باز نمی‌شود — کارِ بچه است، نه دادهٔ کاری.
    """

    list_display = ("thumb", "user", "phone", "title", "mood", "at")
    list_filter = ("mood",)
    search_fields = ("user__phone", "user__first_name", "title")
    list_select_related = ("user",)
    date_hierarchy = "created_at"
    list_per_page = 30

    at = jalali("created_at", "زمان")

    @admin.display(description="نقاشی")
    def thumb(self, obj):
        if not obj.thumbnail:
            return format_html('<span style="color:#bbb">—</span>')
        return format_html(
            '<img src="{}" style="height:44px;border-radius:6px;border:1px solid #ddd">',
            obj.thumbnail)


@admin.register(Secret)
class SecretAdmin(PhoneColumn, ReadOnlyAdmin):
    """
    صندوقچه‌ی رازها.

    متنِ راز سمتِ خودِ گوشی رمز شده و کلیدش هرگز به سرور نمی‌رسد، پس حتی
    سوپرادمین هم نمی‌تواند بازش کند — و نباید بتواند. فقط عنوان دیده می‌شود
    تا اگر کاربری گفت «رازم گم شده» بشود وجودِ ردیف را تأیید کرد.
    """

    list_display = ("user", "phone", "title", "at")
    search_fields = ("user__phone", "title")
    list_select_related = ("user",)
    exclude = ("payload",)
    list_per_page = 50

    at = jalali("created_at", "زمان")

    def has_delete_permission(self, request, obj=None):
        """پاک کردنش از پنل یعنی گم شدنِ رازِ بچه بدونِ اینکه خودش بفهمد."""
        return False


@admin.register(BreathingSession)
class BreathingSessionAdmin(PhoneColumn, ReadOnlyAdmin):
    """تمرین‌های تنفسِ ۴-۴-۴ — ورودیِ گزارشِ سلامتِ والدین."""

    list_display = ("user", "phone", "shown_cycles", "shown_seconds", "at")
    search_fields = ("user__phone", "user__first_name")
    list_select_related = ("user",)
    date_hierarchy = "created_at"
    list_per_page = 50

    at = jalali("created_at", "زمان")

    @admin.display(description="تعداد دور", ordering="cycles")
    def shown_cycles(self, obj):
        return fa_digits(obj.cycles)

    @admin.display(description="مدت", ordering="seconds")
    def shown_seconds(self, obj):
        return fa_digits(f"{obj.seconds} ثانیه")
