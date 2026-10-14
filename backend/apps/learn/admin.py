from django.contrib import admin

from apps.common.admin_helpers import jalali

from .models import LearnItem, LearnProgress


@admin.register(LearnItem)
class LearnItemAdmin(admin.ModelAdmin):
    """همان که داشبورد ← «آموزشِ والدین» می‌سازد"""

    list_display = ("title", "kind", "topic", "premium", "featured", "status", "views", "published")
    list_filter = ("kind", "topic", "premium", "featured", "status")
    list_editable = ("featured", "status")
    search_fields = ("title", "summary", "body")
    readonly_fields = ("views",)

    published = jalali("published_at", "انتشار")


@admin.register(LearnProgress)
class LearnProgressAdmin(admin.ModelAdmin):
    list_display = ("parent", "item", "saved", "done", "seconds")
    list_filter = ("saved", "done")
    raw_id_fields = ("parent", "item")
