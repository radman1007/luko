"""تیکت‌های پشتیبانی."""
from datetime import datetime, timedelta

from django.db import transaction
from django.db.models import Case, Count, IntegerField, Max, Q, Value, When
from django.utils import timezone
from rest_framework.response import Response

from apps.common.fa import parse_jalali
from apps.parent.models import Notification
from apps.support.models import Ticket, TicketMessage

from .. import audit
from ..payloads import fa_ago, fa_stamp, full_name
from ..security import DashboardView, error, paginate
from ..segments import normalized_query

#: پیوندِ اعلانِ «پاسخِ پشتیبانی» — پنلِ والدین با آن همان تیکت را در «تنظیمات ← پشتیبانی» باز می‌کند
def support_link(ticket: Ticket) -> str:
    return f"/parent-panel?p=settings&s=ticket&id={ticket.pk}"


def ticket_row(t: Ticket, now) -> dict:
    return {
        "id": t.id,
        "code": t.code,
        "subject": t.subject,
        "status": t.status,
        "status_label": t.get_status_display(),
        "category": t.category,
        "category_label": t.get_category_display(),
        "priority": t.priority,
        "child_name": full_name(t.child) if t.child_id else "",
        "rating": t.rating,
        "rating_comment": t.rating_comment,
        "user_id": t.user_id,
        "user_name": full_name(t.user) or "بی‌نام",
        "user_phone": t.user.phone,
        "messages": getattr(t, "n_messages", None),
        "last_at_fa": fa_ago(getattr(t, "last_at", None) or t.updated_at, now),
        "created_fa": fa_stamp(t.created_at),
    }


class TicketListView(DashboardView):
    """GET ?status=&q=&from=&to="""

    capability = "tickets"

    def get(self, request):
        p = request.query_params
        now = timezone.now()
        qs = Ticket.objects.select_related("user", "child").annotate(n_messages=Count("messages"),
                                                            last_at=Max("messages__created_at"))
        if p.get("status") in Ticket.Status.values:
            qs = qs.filter(status=p["status"])
        if p.get("category") in Ticket.Category.values:
            qs = qs.filter(category=p["category"])
        q = normalized_query(p.get("q", ""))
        if q:
            qs = qs.filter(Q(subject__icontains=q) | Q(user__phone__contains=q) | Q(user__first_name__icontains=q)
                           | Q(user__last_name__icontains=q) | Q(messages__body__icontains=q)).distinct()
        start = parse_jalali(p.get("from") or "")
        if start:
            qs = qs.filter(created_at__gte=timezone.make_aware(datetime.combine(start, datetime.min.time())))
        end = parse_jalali(p.get("to") or "")
        if end:
            qs = qs.filter(created_at__lt=timezone.make_aware(datetime.combine(end + timedelta(days=1),
                                                                               datetime.min.time())))
        counts = dict(Ticket.objects.values_list("status").annotate(n=Count("pk")))
        # اولویتِ بالا (والدِ مشترک) بالاتر، بعد تازه‌ترین گفت‌وگو
        high = Case(When(priority=Ticket.Priority.HIGH, then=Value(1)), default=Value(0), output_field=IntegerField())
        page, meta = paginate(request, qs.annotate(high=high).order_by("-high", "-last_at", "-updated_at"))
        return Response({"results": [ticket_row(t, now) for t in page], **meta,
                         "counts": {s: counts.get(s, 0) for s in Ticket.Status.values}})


def ticket_detail(ticket: Ticket, now) -> dict:
    return {
        **ticket_row(ticket, now),
        "thread": [
            {"id": m.id, "body": m.body, "is_staff": m.is_staff_reply,
             "sender": "پشتیبانیِ لوکو" if m.is_staff_reply else (full_name(m.sender) or m.sender.phone),
             "staff_name": full_name(m.sender) if m.is_staff_reply else "",
             "at": fa_stamp(m.created_at)}
            for m in ticket.messages.select_related("sender").order_by("created_at")
        ],
    }


class TicketDetailView(DashboardView):
    capability = "tickets"

    def get(self, request, pk):
        ticket = Ticket.objects.select_related("user", "child").filter(pk=pk).first()
        if ticket is None:
            return error("تیکت پیدا نشد.", 404)
        return Response(ticket_detail(ticket, timezone.now()))


class TicketReplyView(DashboardView):
    """POST {body} — پاسخِ تیم؛ تیکت «پاسخ داده شده» می‌شود و والد اعلان می‌گیرد."""

    capability = "tickets"

    @transaction.atomic
    def post(self, request, pk):
        ticket = Ticket.objects.select_for_update().select_related("user").filter(pk=pk).first()
        if ticket is None:
            return error("تیکت پیدا نشد.", 404)
        body = str(request.data.get("body") or "").strip()
        if not body:
            return error("متنِ پاسخ خالی است.")
        if len(body) > 4000:
            return error("پاسخ بیش از ۴۰۰۰ نویسه است.")
        message = TicketMessage.objects.create(ticket=ticket, sender=request.user, body=body, is_staff_reply=True)
        ticket.status = Ticket.Status.ANSWERED
        ticket.save(update_fields=["status", "updated_at"])
        Notification.objects.get_or_create(
            user=ticket.user, dedup_key=f"ticket-reply:{message.pk}",
            defaults={"kind": Notification.Kind.SUPPORT, "title": "پشتیبانی پاسخ داد",
                      "body": f"دربارهٔ «{ticket.subject[:60]}»", "link": support_link(ticket)},
        )
        audit.record(request, "ticket_reply", target=ticket, target_type="ticket",
                     target_label=f"#{ticket.pk} {ticket.subject}", details={"chars": len(body)})
        return Response(ticket_detail(ticket, timezone.now()), status=201)


class TicketStatusView(DashboardView):
    """POST {status: open|answered|closed}"""

    capability = "tickets"

    def post(self, request, pk):
        ticket = Ticket.objects.select_related("user").filter(pk=pk).first()
        if ticket is None:
            return error("تیکت پیدا نشد.", 404)
        status = request.data.get("status")
        if status not in Ticket.Status.values:
            return error("وضعیتِ نامعتبر.")
        old = ticket.status
        ticket.status = status
        ticket.save(update_fields=["status", "updated_at"])
        audit.record(request, "ticket_status", target=ticket, target_type="ticket",
                     target_label=f"#{ticket.pk} {ticket.subject}", details={"from": old, "to": status})
        return Response(ticket_detail(ticket, timezone.now()))
