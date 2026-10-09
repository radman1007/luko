from django.contrib import admin

from apps.common.admin_helpers import ReadOnlyAdmin

from .models import AuditLog, StaffAccess


@admin.register(StaffAccess)
class StaffAccessAdmin(admin.ModelAdmin):
    list_display = ("user", "title", "capabilities", "updated_at")
    search_fields = ("user__phone", "title")


@admin.register(AuditLog)
class AuditLogAdmin(ReadOnlyAdmin):
    list_display = ("created_at", "actor_label", "action", "target_label", "ip")
    list_filter = ("action",)
    search_fields = ("actor_label", "target_label", "ip")
    date_hierarchy = "created_at"
