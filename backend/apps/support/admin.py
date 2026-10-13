from django.contrib import admin

from apps.common.admin_helpers import jalali
from apps.common.fa import fa_digits

from .models import Ticket, TicketMessage


class MessageInline(admin.TabularInline):
    model = TicketMessage
    extra = 1
    fields = ("sender", "body", "is_staff_reply")
    autocomplete_fields = ("sender",)
    verbose_name = "پیام"
    verbose_name_plural = "گفت‌وگو"


@admin.register(Ticket)
class TicketAdmin(admin.ModelAdmin):
    """پاسخِ تیم از همین‌جا داده می‌شود: پیام تازه با «پاسخ تیم پشتیبانی» تیک‌خورده."""

    list_display = ("id", "subject", "user", "phone", "category", "priority", "status", "replies", "rating", "opened")
    list_display_links = ("id", "subject")
    list_filter = ("status", "category", "priority")
    list_editable = ("status",)
    search_fields = ("subject", "user__phone", "user__first_name", "messages__body")
    list_select_related = ("user",)
    # فهرستِ کشوییِ همه‌ی کاربران سنگین است؛ کاربر و فرزند با شناسه انتخاب می‌شوند
    raw_id_fields = ("user", "child")
    readonly_fields = ("user_seen_at", "closed_at", "rating", "rating_comment")
    inlines = [MessageInline]
    list_per_page = 50

    opened = jalali("created_at", "زمان ثبت")

    @admin.display(description="شماره", ordering="user__phone")
    def phone(self, obj):
        return fa_digits(obj.user.phone)

    @admin.display(description="تعداد پیام")
    def replies(self, obj):
        return fa_digits(obj.messages.count())


@admin.register(TicketMessage)
class TicketMessageAdmin(admin.ModelAdmin):
    """
    جداگانه هم ثبت شده تا بشود در متنِ همه‌ی پیام‌ها جست‌وجو کرد — از داخلِ
    تیکت فقط پیام‌های همان تیکت دیده می‌شود.
    """

    list_display = ("ticket", "sender", "is_staff_reply", "short_body", "sent")
    list_filter = ("is_staff_reply",)
    search_fields = ("body", "sender__phone", "ticket__subject")
    list_select_related = ("ticket", "sender")
    autocomplete_fields = ("ticket", "sender")
    list_per_page = 50

    sent = jalali("created_at", "زمان")

    @admin.display(description="متن پیام")
    def short_body(self, obj):
        return obj.body[:70] + ("…" if len(obj.body) > 70 else "")
