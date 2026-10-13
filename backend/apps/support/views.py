"""
تیکت‌های پشتیبانی برای کاربرِ واردشده (پنلِ والدین ← تنظیمات ← پشتیبانی).

GET  /tickets?status=          فهرست + شمارِ هر وضعیت + خوانده‌نشده‌ها + دسته‌ها
POST /tickets                  تیکتِ تازه با اولین پیام (دسته، فرزندِ مربوط، موضوع، متن)
GET  /tickets/{id}             گفت‌وگوی کامل؛ پاسخ‌های تیم «خوانده» می‌شوند
POST /tickets/{id}/reply       پیامِ تازه (تیکتِ بسته نه)
POST /tickets/{id}/close       بستن به دستِ خودِ کاربر
POST /tickets/{id}/rate        امتیاز به پاسخِ پشتیبانی (۱ تا ۵)
"""
from datetime import timedelta

from django.db import transaction
from django.db.models import Count, Prefetch
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Ticket, TicketMessage
from .serializers import CreateTicketSerializer, RateSerializer, ReplySerializer, ticket_detail, ticket_summary

#: سقفِ تیکتِ تازه در ۲۴ ساعت — جلوی هرزنامه، نه کاربرِ واقعی
DAILY_LIMIT = 8


def _error(message: str, code: int = 400) -> Response:
    return Response({"error": {"code": code, "message": message}}, status=code)


def _tickets(user):
    messages = Prefetch("messages", queryset=TicketMessage.objects.select_related("sender").order_by("created_at", "id"))
    return Ticket.objects.filter(user=user).select_related("child").prefetch_related(messages)


def _is_subscriber(user) -> bool:
    """والدی که دست‌کم یک فرزندِ مشترک دارد — تیکتش اولویتِ «بالا» می‌گیرد"""
    from apps.billing.services import subscription
    from apps.parent.models import ParentChild

    links = ParentChild.objects.filter(parent=user, is_active=True).select_related("child")
    return any(subscription(link.child).active for link in links)


class TicketListCreateView(APIView):
    def get(self, request):
        rows = _tickets(request.user)
        counts = dict(Ticket.objects.filter(user=request.user).values_list("status").annotate(n=Count("pk")))
        wanted = request.query_params.get("status")
        summaries = [ticket_summary(t) for t in rows]
        return Response({
            "items": [item for item in summaries if not wanted or item["status"] == wanted],
            "counts": {"all": len(summaries), **{s: counts.get(s, 0) for s in Ticket.Status.values}},
            "unread": sum(item["unread"] for item in summaries),
            "categories": [{"key": key, "label": label} for key, label in Ticket.Category.choices],
            "priority": _is_subscriber(request.user),
        })

    @transaction.atomic
    def post(self, request):
        serializer = CreateTicketSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        recent = Ticket.objects.filter(user=request.user, created_at__gte=timezone.now() - timedelta(days=1)).count()
        if recent >= DAILY_LIMIT:
            return _error("امروز تیکتِ زیادی ثبت کرده‌اید؛ لطفاً در همان تیکت‌های قبلی ادامه دهید.", 429)

        child = None
        if data.get("child_id"):
            from apps.parent.models import ParentChild

            link = ParentChild.objects.filter(parent=request.user, child_id=data["child_id"], is_active=True) \
                .select_related("child").first()
            if link is None:
                return _error("این فرزند به حسابِ شما وصل نیست.")
            child = link.child

        ticket = Ticket.objects.create(
            user=request.user, subject=data["subject"], category=data["category"], child=child,
            priority=Ticket.Priority.HIGH if _is_subscriber(request.user) else Ticket.Priority.NORMAL,
            user_seen_at=timezone.now(),
        )
        TicketMessage.objects.create(ticket=ticket, sender=request.user, body=data["body"])
        return Response(ticket_detail(_tickets(request.user).get(pk=ticket.pk)), status=status.HTTP_201_CREATED)


class _OwnTicket(APIView):
    def ticket(self, request, pk) -> Ticket | None:
        return _tickets(request.user).filter(pk=pk).first()


class TicketDetailView(_OwnTicket):
    def get(self, request, pk):
        ticket = self.ticket(request, pk)
        if ticket is None:
            return _error("تیکت پیدا نشد.", 404)
        body = ticket_detail(ticket)
        # همین که باز شد، پاسخ‌های تیم خوانده شده‌اند؛ خروجی هنوز «تازه» بودنشان را نشان می‌دهد
        Ticket.objects.filter(pk=ticket.pk).update(user_seen_at=timezone.now())
        return Response(body)


class TicketReplyView(_OwnTicket):
    def post(self, request, pk):
        ticket = self.ticket(request, pk)
        if ticket is None:
            return _error("تیکت پیدا نشد.", 404)
        if ticket.status == Ticket.Status.CLOSED:
            return _error("این تیکت بسته شده است؛ برای ادامه، تیکتِ تازه‌ای بسازید.")
        serializer = ReplySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        TicketMessage.objects.create(ticket=ticket, sender=request.user, body=serializer.validated_data["body"])
        Ticket.objects.filter(pk=ticket.pk).update(status=Ticket.Status.OPEN, user_seen_at=timezone.now(),
                                                   updated_at=timezone.now())
        return Response(ticket_detail(self.ticket(request, pk)), status=status.HTTP_201_CREATED)


class TicketCloseView(_OwnTicket):
    def post(self, request, pk):
        ticket = self.ticket(request, pk)
        if ticket is None:
            return _error("تیکت پیدا نشد.", 404)
        if ticket.status != Ticket.Status.CLOSED:
            now = timezone.now()
            Ticket.objects.filter(pk=ticket.pk).update(status=Ticket.Status.CLOSED, closed_at=now,
                                                       user_seen_at=now, updated_at=now)
        return Response(ticket_detail(self.ticket(request, pk)))


class TicketRateView(_OwnTicket):
    def post(self, request, pk):
        ticket = self.ticket(request, pk)
        if ticket is None:
            return _error("تیکت پیدا نشد.", 404)
        if not any(m.is_staff_reply for m in ticket.messages.all()):
            return _error("هنوز پاسخی از پشتیبانی نیامده که امتیاز بدهید.")
        serializer = RateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        Ticket.objects.filter(pk=ticket.pk).update(rating=serializer.validated_data["rating"],
                                                   rating_comment=serializer.validated_data["comment"].strip())
        return Response(ticket_detail(self.ticket(request, pk)))
