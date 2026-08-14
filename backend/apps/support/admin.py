from django.contrib import admin

from .models import Ticket, TicketMessage


class MessageInline(admin.TabularInline):
    model = TicketMessage
    extra = 1
    fields = ("sender", "body", "is_staff_reply")


@admin.register(Ticket)
class TicketAdmin(admin.ModelAdmin):
    """پاسخِ تیم از همین‌جا داده می‌شود: پیام تازه با is_staff_reply=True."""

    list_display = ("id", "subject", "user", "status", "created_at")
    list_filter = ("status",)
    list_editable = ("status",)
    search_fields = ("subject", "user__phone")
    inlines = [MessageInline]
