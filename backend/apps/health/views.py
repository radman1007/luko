from rest_framework import generics
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import MoodCheckin, Painting, Secret
from .serializers import (BreathingSessionSerializer, MoodCheckinSerializer,
                          PaintingCreateSerializer, PaintingImageSerializer,
                          PaintingSerializer, SecretSerializer)
from .services import mood_prompt, record_device_mood


class MoodPromptView(APIView):
    """آیا الان باید حالِ دل بپرسیم؟ (هر نیم‌ساعت)."""

    def get(self, request):
        return Response(mood_prompt(request.user))


class MoodCheckinView(generics.ListCreateAPIView):
    serializer_class = MoodCheckinSerializer
    pagination_class = None  # آرایه‌ی ساده (فرانت لیست می‌خواهد)

    def get_queryset(self):
        return self.request.user.mood_checkins.all()[:50]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        checkin = record_device_mood(request.user, data["mood"], data.get("at"))
        if checkin is None:
            # همین حال پیش‌تر (از راهِ هم‌رسانی) رسیده بود
            checkin = request.user.mood_checkins.filter(client_at=data.get("at")).first() \
                or request.user.mood_checkins.first()
        return Response(MoodCheckinSerializer(checkin).data, status=201)


# سقفِ نقاشی‌های نگه‌داشته‌شده برای هر بچه؛ قدیمی‌ترین‌ها کنار می‌روند
MAX_PAINTINGS = 60


class PaintingListCreateView(generics.ListCreateAPIView):
    """ذخیره‌ی نقاشی هنگام «نگهش‌دار» + فهرستِ گالری (بدونِ تصویرِ کامل)."""

    pagination_class = None

    def get_serializer_class(self):
        return PaintingCreateSerializer if self.request.method == "POST" else PaintingSerializer

    def get_queryset(self):
        # `image` عمداً از فهرست بیرون می‌ماند؛ چند ده تصویرِ کامل پاسخ را سنگین می‌کند
        return self.request.user.paintings.defer("image")[:MAX_PAINTINGS]

    def perform_create(self, serializer):
        painting = serializer.save(user=self.request.user)
        # نگه‌داشتنِ بی‌نهایت نقاشی نه لازم است نه سالم؛ قدیمی‌ها می‌روند
        extra = list(
            self.request.user.paintings.values_list("id", flat=True)[MAX_PAINTINGS:]
        )
        if extra:
            Painting.objects.filter(id__in=extra).delete()
        return painting


class PaintingImageView(generics.RetrieveAPIView):
    """تصویرِ کاملِ یک نقاشی — فقط برای صاحبش."""

    serializer_class = PaintingImageSerializer

    def get_queryset(self):
        return self.request.user.paintings.all()


class PaintingDestroyView(generics.DestroyAPIView):
    """حذفِ نقاشی. کوئری به کاربر محدود است، پس شناسه‌ی دیگری کار نمی‌کند."""

    def get_queryset(self):
        return self.request.user.paintings.all()

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
