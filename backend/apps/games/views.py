from rest_framework.generics import ListAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Game
from .serializers import GameEventSerializer, GameSerializer
from .services import complete_game


class GameListView(ListAPIView):
    """کاتالوگِ بازی‌ها (فیلترِ کتاب اختیاری)."""
    serializer_class = GameSerializer
    queryset = Game.objects.filter(is_active=True)
    filterset_fields = ["book_id"]
    pagination_class = None


class GameCompleteView(APIView):
    """POST /games/<slug>/complete — پاداش سمت سرور محاسبه می‌شود."""

    def post(self, request, slug):
        result = complete_game(request.user, slug)
        return Response(result)


class GameEventView(APIView):
    """
    POST /games/events — ثبتِ رویدادهای داخل بازی برای تحلیل.
    یک رویداد یا فهرستی از رویدادها می‌پذیرد.
    """

    def post(self, request):
        many = isinstance(request.data, list)
        serializer = GameEventSerializer(data=request.data, many=many)
        serializer.is_valid(raise_exception=True)
        serializer.save(user=request.user)
        return Response({"stored": len(serializer.data) if many else 1})
