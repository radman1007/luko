from rest_framework.generics import ListAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Book, Game
from .serializers import BookSerializer, GameEventSerializer, GameSerializer
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


class BookListView(APIView):
    """GET /books — کاتالوگِ کتاب‌ها با مراحل (جایگزینِ booksData ثابتِ فرانت)."""

    def get(self, request):
        books = Book.objects.filter(is_active=True)
        grade = request.query_params.get("grade")
        if grade:
            books = books.filter(grade=grade)
        games_by_book: dict = {}
        for game in Game.objects.filter(is_active=True):
            games_by_book.setdefault(game.book_id, []).append(game)
        data = BookSerializer(books, many=True,
                              context={"games_by_book": games_by_book}).data
        completed = list(
            request.user.game_completions.values_list("game_slug", flat=True)
        )
        return Response({"books": data, "completed": completed})
