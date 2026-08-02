from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import KidSettings, Lukorian, Profile, User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    ordering = ("-date_joined",)
    list_display = ("phone", "first_name", "last_name", "role", "is_active", "is_staff")
    list_filter = ("role", "is_active", "is_staff")
    search_fields = ("phone", "first_name", "last_name")
    filter_horizontal = ("guardians", "groups", "user_permissions")
    fieldsets = (
        (None, {"fields": ("phone", "password")}),
        ("مشخصات", {"fields": ("first_name", "last_name", "role", "guardians")}),
        ("دسترسی", {"fields": ("is_active", "is_staff", "is_superuser", "groups",
                               "user_permissions")}),
    )
    add_fieldsets = (
        (None, {"classes": ("wide",),
                "fields": ("phone", "first_name", "last_name", "role", "password1",
                           "password2")}),
    )


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
