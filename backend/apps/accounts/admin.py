from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.html import format_html

from .models import KidSettings, Lukorian, PasswordVault, Profile, User

SUPPORT_SECTION = "پشتیبانی"


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    ordering = ("-date_joined",)
    list_display = ("phone", "first_name", "last_name", "role", "phone_verified",
                    "is_active", "is_staff")
    list_filter = ("role", "phone_verified", "is_active", "is_staff")
    search_fields = ("phone", "first_name", "last_name")
    filter_horizontal = ("guardians", "groups", "user_permissions")
    readonly_fields = ("support_password", "phone_verified_at")
    fieldsets = (
        (None, {"fields": ("phone", "password")}),
        ("مشخصات", {"fields": ("first_name", "last_name", "role", "guardians")}),
        ("شماره", {"fields": ("phone_verified", "phone_verified_at")}),
        (SUPPORT_SECTION, {
            "fields": ("support_password",),
            "description": "رمزِ کاربر برای کمکِ تلفنی. رمزنگاری‌شده ذخیره می‌شود و "
                           "فقط با کلیدِ سرور خوانده می‌شود — فقط سوپرادمین می‌بیندش.",
        }),
        ("دسترسی", {"fields": ("is_active", "is_staff", "is_superuser", "groups",
                               "user_permissions")}),
    )
    add_fieldsets = (
        (None, {"classes": ("wide",),
                "fields": ("phone", "first_name", "last_name", "role", "password1",
                           "password2")}),
    )

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
class ProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "coins", "points", "treasures")
    search_fields = ("user__phone", "user__first_name", "user__last_name")


@admin.register(KidSettings)
class KidSettingsAdmin(admin.ModelAdmin):
    list_display = ("user", "sound", "music", "mood_reminder")


@admin.register(Lukorian)
class LukorianAdmin(admin.ModelAdmin):
    list_display = ("user", "unlocked", "is_built", "custom_status")
    list_filter = ("unlocked", "is_built", "custom_status")


@admin.register(PasswordVault)
class PasswordVaultAdmin(admin.ModelAdmin):
    """فهرستِ رمزها برای پشتیبانی — جست‌وجو با شماره‌ی کاربر. فقط سوپرادمین."""

    list_display = ("user", "shown", "updated_at")
    search_fields = ("user__phone", "user__first_name", "user__last_name")
    readonly_fields = ("user", "shown", "sealed")

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
