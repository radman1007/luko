from django.contrib import admin

from apps.common.admin_helpers import ReadOnlyAdmin

from .models import Broadcast, KidNotice


@admin.register(Broadcast)
class BroadcastAdmin(ReadOnlyAdmin):
    list_display = ("title", "audience", "recipients", "sent_by", "created_at")
    list_filter = ("audience",)
    search_fields = ("title", "body")


@admin.register(KidNotice)
class KidNoticeAdmin(ReadOnlyAdmin):
    list_display = ("user", "title", "is_read", "created_at")
    list_filter = ("is_read",)
    search_fields = ("user__phone", "title")
    list_select_related = ("user",)
