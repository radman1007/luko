"""
شکلِ سیمِ تیکت‌ها برای پنلِ والدین (کلیدها با رندررِ camelCase می‌شوند).

فهرست فقط خلاصه دارد (پیشِ‌نمایشِ آخرین پیام، شمارِ خوانده‌نشده)؛ گفت‌وگوی کامل با جزئیات می‌آید.
"""
from django.utils import timezone
from rest_framework import serializers

from apps.common.fa import fa_when

from .models import Ticket

PREVIEW = 120
MIN_SUBJECT = 4
MIN_BODY = 10
MAX_BODY = 4000


def _when(value) -> str:
    return fa_when(timezone.localtime(value), timezone.localdate()) if value else ""


def _name(user) -> str:
    return f"{user.first_name} {user.last_name}".strip() if user else ""


def unread_count(ticket: Ticket) -> int:
    """پاسخ‌های تیم بعد از آخرین بازدیدِ فرستنده (پیام‌ها پیش‌واکشی شده‌اند)"""
    seen = ticket.user_seen_at
    return sum(1 for m in ticket.messages.all() if m.is_staff_reply and (seen is None or m.created_at > seen))


def ticket_summary(ticket: Ticket) -> dict:
    messages = list(ticket.messages.all())
    last = messages[-1] if messages else None
    return {
        "id": ticket.id,
        "code": ticket.code,
        "subject": ticket.subject,
        "category": ticket.category,
        "category_label": ticket.get_category_display(),
        "status": ticket.status,
        "status_label": ticket.get_status_display(),
        "priority": ticket.priority,
        "child_id": str(ticket.child_id) if ticket.child_id else None,
        "child_name": _name(ticket.child),
        "created_at": ticket.created_at,
        "created_fa": _when(ticket.created_at),
        "last_at": last.created_at if last else ticket.created_at,
        "last_fa": _when(last.created_at if last else ticket.created_at),
        "preview": (last.body[:PREVIEW] + ("…" if len(last.body) > PREVIEW else "")) if last else "",
        "last_from_staff": bool(last and last.is_staff_reply),
        "messages": len(messages),
        "unread": unread_count(ticket),
        "rating": ticket.rating,
    }


def ticket_detail(ticket: Ticket) -> dict:
    messages = list(ticket.messages.all())
    answered = any(m.is_staff_reply for m in messages)
    return {
        **ticket_summary(ticket),
        "closed_fa": _when(ticket.closed_at),
        "rating_comment": ticket.rating_comment,
        "can_reply": ticket.status != Ticket.Status.CLOSED,
        "can_close": ticket.status != Ticket.Status.CLOSED,
        "can_rate": answered and ticket.rating is None,
        "thread": [{
            "id": m.id,
            "body": m.body,
            "from_staff": m.is_staff_reply,
            "sender": "پشتیبانی لوکو" if m.is_staff_reply else (_name(m.sender) or "شما"),
            "at": m.created_at,
            "at_fa": _when(m.created_at),
        } for m in messages],
    }


class CreateTicketSerializer(serializers.Serializer):
    category = serializers.ChoiceField(choices=Ticket.Category.choices, default=Ticket.Category.OTHER)
    child_id = serializers.IntegerField(required=False, allow_null=True)
    subject = serializers.CharField(max_length=140)
    body = serializers.CharField(max_length=MAX_BODY)

    def validate_subject(self, value):
        value = value.strip()
        if len(value) < MIN_SUBJECT:
            raise serializers.ValidationError("موضوع را کمی کامل‌تر بنویسید.")
        return value

    def validate_body(self, value):
        value = value.strip()
        if len(value) < MIN_BODY:
            raise serializers.ValidationError("متنِ پیام خیلی کوتاه است؛ کمی بیشتر توضیح دهید.")
        return value


class ReplySerializer(serializers.Serializer):
    body = serializers.CharField(max_length=MAX_BODY)

    def validate_body(self, value):
        value = value.strip()
        if len(value) < 2:
            raise serializers.ValidationError("پیام خالی است.")
        return value


class RateSerializer(serializers.Serializer):
    rating = serializers.IntegerField(min_value=1, max_value=5)
    comment = serializers.CharField(max_length=300, required=False, allow_blank=True, default="")
