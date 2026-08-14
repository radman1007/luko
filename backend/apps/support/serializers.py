from rest_framework import serializers

from .models import Ticket, TicketMessage


class TicketMessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()

    class Meta:
        model = TicketMessage
        fields = ["id", "body", "is_staff_reply", "sender_name", "created_at"]
        read_only_fields = ["is_staff_reply", "created_at"]

    def get_sender_name(self, obj) -> str:
        return f"{obj.sender.first_name} {obj.sender.last_name}".strip() or "کاربر"


class TicketSerializer(serializers.ModelSerializer):
    messages = TicketMessageSerializer(many=True, read_only=True)
    last_message_at = serializers.DateTimeField(source="updated_at", read_only=True)

    class Meta:
        model = Ticket
        fields = ["id", "subject", "status", "created_at", "last_message_at", "messages"]
        read_only_fields = ["status", "created_at"]


class CreateTicketSerializer(serializers.Serializer):
    subject = serializers.CharField(max_length=140)
    body = serializers.CharField()


class ReplySerializer(serializers.Serializer):
    body = serializers.CharField()
