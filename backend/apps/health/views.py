from rest_framework import generics
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import MoodCheckin, Painting, Secret
from .serializers import BreathingSessionSerializer, MoodCheckinSerializer, PaintingSerializer, SecretSerializer
from .services import mood_prompt


class MoodPromptView(APIView):
    """آیا الان باید حالِ دل بپرسیم؟ (هر نیم‌ساعت)."""

    def get(self, request):
        return Response(mood_prompt(request.user))


class MoodCheckinView(generics.ListCreateAPIView):
    serializer_class = MoodCheckinSerializer
    pagination_class = None  # آرایه‌ی ساده (فرانت لیست می‌خواهد)

    def get_queryset(self):
        return self.request.user.mood_checkins.all()[:50]

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class PaintingListCreateView(generics.ListCreateAPIView):
    """ذخیره‌ی نقاشی هنگام «نگهش‌دار» + فهرستِ نقاشی‌ها."""
    serializer_class = PaintingSerializer
    pagination_class = None

    def get_queryset(self):
        return self.request.user.paintings.all()[:60]

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class SecretListCreateView(generics.ListCreateAPIView):
    """صندوقچه‌ی رازها — payload از قبل رمزنگاری‌شده ذخیره می‌شود."""
    serializer_class = SecretSerializer
    pagination_class = None

    def get_queryset(self):
        return self.request.user.secrets.all()

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class SecretDestroyView(generics.DestroyAPIView):
    """حذفِ راز (بچه سمت کلاینت با رمز درست تأیید می‌کند، بعد این را صدا می‌زند)."""
    serializer_class = SecretSerializer

    def get_queryset(self):
        return self.request.user.secrets.all()


class BreathingSessionView(generics.ListCreateAPIView):
    """ثبتِ دورِ کاملِ تمرینِ تنفس — ورودیِ بخشِ سلامتِ گزارشِ والدین."""
    serializer_class = BreathingSessionSerializer
    pagination_class = None

    def get_queryset(self):
        return self.request.user.breathing_sessions.all()[:60]

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
