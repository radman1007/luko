from django.contrib import admin

from apps.common.admin_helpers import ReadOnlyAdmin

from .models import ActivitySlot


@admin.register(ActivitySlot)
class ActivitySlotAdmin(ReadOnlyAdmin):
    list_display = ("visitor", "audience", "platform", "hour", "minutes", "last_beat")
    list_filter = ("platform", "audience")
    search_fields = ("visitor", "user__phone")
    date_hierarchy = "hour"
    list_per_page = 50
