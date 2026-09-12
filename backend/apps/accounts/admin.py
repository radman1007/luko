from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.html import format_html

from apps.common.admin_helpers import ReadOnlyAdmin, counter, jalali
from apps.common.fa import fa_digits

from .models import KidSettings, Lukorian, PasswordVault, Profile, User

SUPPORT_SECTION = "پشتیبانی"


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """
    کاربران — قلبِ پنل.

    یک شماره می‌تواند چند ردیف داشته باشد (والد + چند بچه)، پس ستونِ شماره
    به‌تنهایی گویا نیست و «نقش» همیشه کنارش می‌آید. جست‌وجو روی شماره و نام
    است چون پشتیبانی همیشه از همین دو شروع می‌کند.
    """

    ordering = ("-date_joined",)
    list_display = ("full_name", "shown_phone", "role", "shown_grade", "verified",
                    "is_active", "joined")
    list_display_links = ("full_name", "shown_phone")
    list_filter = ("role", "grade", "phone_verified", "is_active", "is_staff")
    search_fields = ("phone", "first_name", "last_name")
    list_per_page = 50
    filter_horizontal = ("guardians", "groups", "user_permissions")
    readonly_fields = ("support_password", "phone_verified_at", "date_joined",
                       "last_login", "session_version")
    fieldsets = (
        ("ورود", {"fields": ("phone", "password")}),
        ("مشخصات", {"fields": ("first_name", "last_name", "role", "grade", "guardians")}),
        ("تأییدِ شماره", {"fields": ("phone_verified", "phone_verified_at")}),
        (SUPPORT_SECTION, {
            "fields": ("support_password",),
            "description": "رمزِ کاربر برای کمکِ تلفنی. رمزنگاری‌شده ذخیره می‌شود و "
                           "فقط با کلیدِ سرور خوانده می‌شود — فقط سوپرادمین می‌بیندش.",
        }),
        ("دسترسی", {"fields": ("is_active", "is_staff", "is_superuser", "groups",
                               "user_permissions")}),
        ("سوابق", {
            "fields": ("date_joined", "last_login", "session_version"),
            "description": "«نسخه نشست» با هر ورود یکی جلو می‌رود و نشستِ دستگاهِ "
                           "قبلی را می‌بندد. دستی عوض نمی‌شود.",
            "classes": ("collapse",),
        }),
    )
    add_fieldsets = (
        (None, {"classes": ("wide",),
                "fields": ("phone", "first_name", "last_name", "role", "grade",
                           "password1", "password2")}),
    )

    joined = jalali("date_joined", "تاریخ عضویت")

    @admin.display(description="نام", ordering="first_name")
    def full_name(self, obj):
        name = f"{obj.first_name} {obj.last_name}".strip()
        return name or format_html('<span style="color:#bbb">بی‌نام</span>')

    @admin.display(description="شماره", ordering="phone")
    def shown_phone(self, obj):
        return fa_digits(obj.phone)

    @admin.display(description="پایه", ordering="grade")
    def shown_grade(self, obj):
        """پایه فقط برای دانش‌آموز معنا دارد؛ برای والد نشان دادنش گمراه‌کننده است."""
        if obj.role != User.Role.STUDENT:
            return "—"
        return obj.get_grade_display()

    @admin.display(description="شماره تأیید شده", boolean=True, ordering="phone_verified")
    def verified(self, obj):
        return obj.phone_verified

    def get_fieldsets(self, request, obj=None):
        """
        بخشِ رمز را برای غیرِ سوپرادمین از فرم حذف می‌کنیم.
        گِیت روی خودِ درخواست است، نه روی نمونه‌ی ModelAdmin — آن نمونه بینِ
        همه‌ی درخواست‌های همزمان مشترک است و نگه‌داشتنِ request رویش نشتی می‌دهد.
        """
        fieldsets = super().get_fieldsets(request, obj)
        if request.user.is_superuser:
            return fieldsets
        return tuple(fs for fs in fieldsets if fs[0] != SUPPORT_SECTION)

    @admin.display(description="رمزِ کاربر")
    def support_password(self, obj):
        """رمزِ خوانا برای پشتیبانی — فقط جایی رندر می‌شود که سوپرادمین باشد."""
        vault = PasswordVault.objects.filter(user=obj).first()
        if vault is None or not vault.sealed:
            return format_html('<span style="color:#999">رمزی ثبت نشده</span>')
        shown = vault.reveal()
        if shown is None:
            return format_html('<span style="color:#c0392b">کلیدِ گاوصندوق تنظیم نیست</span>')
        return format_html('<code style="font-size:15px;user-select:all">{}</code>', shown)


@admin.register(Profile)
class ProfileAdmin(ReadOnlyAdmin):
    """
    شمارنده‌های کاربر.

    فقط-خواندنی است چون سکه و گنج را سرور از روی کارِ واقعیِ بچه می‌دهد؛
    دست‌بردن از پنل همان قانونِ «هر عددِ باارزش سمتِ سرور» را می‌شکند.
    """

    list_display = ("user", "phone", "coins_", "points_", "treasures_", "changed")
    search_fields = ("user__phone", "user__first_name", "user__last_name")
    list_select_related = ("user",)
    list_per_page = 50

    changed = jalali("updated_at", "آخرین تغییر")

    @admin.display(description="شماره", ordering="user__phone")
    def phone(self, obj):
        return fa_digits(obj.user.phone)

    @admin.display(description="سکه", ordering="coins")
    def coins_(self, obj):
        return counter(obj.coins)

    @admin.display(description="امتیاز", ordering="points")
    def points_(self, obj):
        return counter(obj.points)

    @admin.display(description="گنج", ordering="treasures")
    def treasures_(self, obj):
        return counter(obj.treasures)


@admin.register(KidSettings)
class KidSettingsAdmin(admin.ModelAdmin):
    list_display = ("user", "sound", "music", "mood_reminder")
    list_filter = ("sound", "music", "mood_reminder")
    search_fields = ("user__phone", "user__first_name")
    list_select_related = ("user",)


@admin.register(Lukorian)
class LukorianAdmin(admin.ModelAdmin):
    list_display = ("user", "unlocked", "is_built", "custom_status")
    list_filter = ("unlocked", "is_built", "custom_status")
    search_fields = ("user__phone", "user__first_name")
    list_select_related = ("user",)


@admin.register(PasswordVault)
class PasswordVaultAdmin(admin.ModelAdmin):
    """فهرستِ رمزها برای پشتیبانی — جست‌وجو با شماره‌ی کاربر. فقط سوپرادمین."""

    list_display = ("user", "phone", "shown", "changed")
    search_fields = ("user__phone", "user__first_name", "user__last_name")
    readonly_fields = ("user", "shown", "sealed")
    list_select_related = ("user",)

    changed = jalali("updated_at", "آخرین تغییر")

    @admin.display(description="شماره", ordering="user__phone")
    def phone(self, obj):
        return fa_digits(obj.user.phone)

    def has_add_permission(self, request):
        return False

    def has_module_permission(self, request):
        return request.user.is_superuser

    def has_view_permission(self, request, obj=None):
        return request.user.is_superuser

    def has_change_permission(self, request, obj=None):
        return request.user.is_superuser

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser

    @admin.display(description="رمز")
    def shown(self, obj):
        value = obj.reveal()
        return value if value is not None else "کلیدِ گاوصندوق تنظیم نیست"
