from django.db import transaction
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Ticket, TicketMessage
from .serializers import (
    CreateTicketSerializer,
    ReplySerializer,
    TicketMessageSerializer,
    TicketSerializer,
)


class TicketListCreateView(APIView):
    """GET تیکت‌های خودم · POST تیکت تازه (با اولین پیام)."""

    def get(self, request):
        tickets = Ticket.objects.filter(user=request.user).prefetch_related("messages")
        return Response(TicketSerializer(tickets, many=True).data)

    @transaction.atomic
    def post(self, request):
        serializer = CreateTicketSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ticket = Ticket.objects.create(
            user=request.user, subject=serializer.validated_data["subject"]
        )
        TicketMessage.objects.create(
            ticket=ticket, sender=request.user, body=serializer.validated_data["body"]
        )
        ticket.refresh_from_db()
        return Response(TicketSerializer(ticket).data, status=status.HTTP_201_CREATED)


class TicketReplyView(APIView):
    """POST /tickets/{id}/reply — پاسخِ کاربر روی تیکتِ خودش."""

    def post(self, request, pk):
        ticket = Ticket.objects.filter(pk=pk, user=request.user).first()
        if ticket is None:
            return Response({"error": {"code": 404, "message": "تیکت پیدا نشد."}},
                            status=status.HTTP_404_NOT_FOUND)
        if ticket.status == Ticket.Status.CLOSED:
            return Response({"error": {"code": 400, "message": "این تیکت بسته شده است."}},
                            status=status.HTTP_400_BAD_REQUEST)

        serializer = ReplySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        message = TicketMessage.objects.create(
            ticket=ticket, sender=request.user, body=serializer.validated_data["body"]
        )
        ticket.status = Ticket.Status.OPEN
        ticket.save(update_fields=["status", "updated_at"])
        return Response(TicketMessageSerializer(message).data,
                        status=status.HTTP_201_CREATED)
