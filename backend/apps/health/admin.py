from django.contrib import admin

from .models import MoodCheckin, Painting, Secret


@admin.register(MoodCheckin)
class MoodCheckinAdmin(admin.ModelAdmin):
    list_display = ("user", "mood", "created_at")
    list_filter = ("mood", "created_at")
    search_fields = ("user__phone",)


@admin.register(Painting)
class PaintingAdmin(admin.ModelAdmin):
    list_display = ("user", "mood", "created_at")
    list_filter = ("mood", "created_at")


@admin.register(Secret)
class SecretAdmin(admin.ModelAdmin):
    # عمداً payload نمایش داده نمی‌شود — رمزنگاری‌شده و خصوصیِ بچه است.
    list_display = ("user", "title", "created_at")
    search_fields = ("user__phone", "title")
    readonly_fields = ("payload",)
