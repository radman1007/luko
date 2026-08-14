from rest_framework import serializers

from .models import BreathingSession, MoodCheckin, Painting, Secret


class MoodCheckinSerializer(serializers.ModelSerializer):
    class Meta:
        model = MoodCheckin
        fields = ["id", "mood", "created_at"]
        read_only_fields = ["id", "created_at"]


class PaintingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Painting
        fields = ["id", "mood", "colors", "thumbnail", "created_at"]
        read_only_fields = ["id", "created_at"]


class SecretSerializer(serializers.ModelSerializer):
    class Meta:
        model = Secret
        fields = ["id", "title", "payload", "created_at"]
        read_only_fields = ["id", "created_at"]


class BreathingSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = BreathingSession
        fields = ["id", "cycles", "seconds", "created_at"]
        read_only_fields = ["id", "created_at"]
