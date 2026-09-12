"""
تکه‌های مشترکِ پنلِ ادمین.

سه چیز را یک‌جا نگه می‌دارد تا در هشت اپ تکرار نشود: تاریخِ شمسی، ستونِ
«کاربر» با شماره‌ی خوانا، و کلاسِ پایه‌ی «فقط خواندنی» برای جدول‌هایی که
داده‌ی واقعیِ بچه‌ها را نگه می‌دارند و دست‌کاری‌شان از پنل معنا ندارد.
"""
from django.contrib import admin
from django.utils.html import format_html

from .fa import fa_date, fa_digits, fa_when


def jalali(field: str, label: str, *, with_time: bool = True):
    """
    ستونی که تاریخ را شمسی نشان می‌دهد.

    تاریخِ میلادی در پنلی که بقیه‌اش فارسی است غریبه می‌افتد و برای تیمِ
    پشتیبانی که با والدین حرف می‌زند مستقیماً قابلِ استفاده نیست.
    `admin_order_field` را نگه می‌داریم تا مرتب‌سازی روی ستون کار کند.
    """
    @admin.display(description=label, ordering=field)
    def column(self, obj):
        value = getattr(obj, field, None)
        if value is None:
            return "—"
        return fa_when(value) if with_time and hasattr(value, "hour") else fa_date(
            value, with_year=True)
    return column


@admin.display(description="شماره", ordering="user__phone")
def user_phone(self, obj):
    """شماره‌ی صاحبِ ردیف — ستونی که پشتیبانی بیشتر از همه با آن جست‌وجو می‌کند."""
    user = getattr(obj, "user", None)
    return fa_digits(user.phone) if user else "—"


def counter(value: int) -> str:
    """عدد با رقمِ فارسی؛ صفر کم‌رنگ می‌شود تا چشم روی ردیف‌های پرمحتوا برود."""
    if not value:
        return format_html('<span style="color:#bbb">۰</span>')
    return fa_digits(value)


class ReadOnlyAdmin(admin.ModelAdmin):
    """
    جدولِ فقط-خواندنی.

    داده‌هایی مثل رویدادِ بازی، ثبتِ حال یا خریدها گزارشِ چیزی هستند که
    واقعاً اتفاق افتاده. ویرایششان از پنل یعنی دست‌کاریِ تاریخچه — هم
    گزارشِ والد را دروغ می‌کند هم تحلیلِ بعدی را. پس فقط دیده می‌شوند.
    حذف باز می‌ماند چون گاهی باید ردیفِ آزمایشی یا اشتباه پاک شود.
    """

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
