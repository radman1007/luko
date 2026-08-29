from rest_framework import status
from rest_framework.generics import ListAPIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.parent.services import invalidate_child_report

from .models import Book, Game
from .serializers import BookSerializer, GameEventSerializer, GameSerializer
from apps.common import cache

from .playlink import sign
from .services import StageLocked, blocking_stage, complete_game, completed_slugs


class GameListView(ListAPIView):
    """کاتالوگِ بازی‌ها (فیلترِ کتاب اختیاری)."""
    serializer_class = GameSerializer
    queryset = Game.objects.filter(is_active=True)
    filterset_fields = ["book_id"]
    pagination_class = None


class GameCompleteView(APIView):
    """POST /games/<slug>/complete — پاداش سمت سرور محاسبه می‌شود."""

    def post(self, request, slug):
        try:
            result = complete_game(request.user, slug)
        except StageLocked as exc:
            return Response(
                {"error": {"code": 403,
                           "message": f"اول باید مرحله‌ی «{exc.args[0]}» را تمام کنی."}},
                status=status.HTTP_403_FORBIDDEN,
            )
        return Response(result)


class GamePlayLinkView(APIView):
    """
    GET /games/<slug>/play-link — آدرسِ کوتاه‌عمرِ فایلِ بازی.

    فایل‌ها دیگر مستقیم قابلِ دانلود نیستند؛ nginx فقط لینکِ امضاشده را
    می‌پذیرد. امضا فقط برای مرحله‌ای داده می‌شود که همین کاربر بازش کرده،
    پس یک حساب هم نمی‌تواند یک‌جا همه‌ی بازی‌ها را بردارد.
    """

    permission_classes = [AllowAny]     # مهمان فقط مرحله‌ی اول را می‌گیرد
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "play_link"

    def get(self, request, slug):
        game = Game.objects.filter(slug=slug, is_active=True).first()
        if game is None or not game.game_file:
            return Response(
                {"error": {"code": 404, "message": "این بازی وجود ندارد."}},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not request.user.is_authenticated:
            # بدونِ حساب فقط مرحله‌ی اولِ مسیر باز است (حالتِ مهمان/نمایش)
            if game.season_order != 1:
                return Response(
                    {"error": {"code": 401, "message": "برای بازیِ این مرحله باید وارد شوی."}},
                    status=status.HTTP_401_UNAUTHORIZED,
                )
        elif blocking_stage(request.user, game) is not None:
            return Response(
                {"error": {"code": 403, "message": "این مرحله هنوز باز نشده است."}},
                status=status.HTTP_403_FORBIDDEN,
            )

        return Response({"url": sign(game.game_file)})


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
        # گزارشِ والد از همین رویدادها ساخته می‌شود؛ پس کشِ آن باید بیفتد
        invalidate_child_report(request.user.id)
        return Response({"stored": len(serializer.data) if many else 1})


class CompletedGamesView(APIView):
    """
    GET /games/completed — فقط شناسه‌ی مرحله‌های تمام‌شده.

    نقشه‌ی سیزن همین را می‌خواهد و بس. تا دیروز برای گرفتنش کلِ کاتالوگ
    (چهار کتاب و ۲۷ مرحله) سریالایز و فرستاده می‌شد؛ همان مسیر کندترین
    نقطه‌ی APIها بود.
    """

    def get(self, request):
        return Response({"completed": completed_slugs(request.user)})


class BookListView(APIView):
    """GET /books — کاتالوگِ کتاب‌ها با مراحل (جایگزینِ booksData ثابتِ فرانت)."""

    def get(self, request):
        grade = request.query_params.get("grade")

        def build():
            books = Book.objects.filter(is_active=True)
            if grade:
                books = books.filter(grade=grade)
            games_by_book: dict = {}
            for game in Game.objects.filter(is_active=True):
                games_by_book.setdefault(game.book_id, []).append(game)
            return BookSerializer(books, many=True,
                                  context={"games_by_book": games_by_book}).data

        # کاتالوگ برای همه یکی است و فقط با ویرایشِ ادمین عوض می‌شود
        data = cache.get_or_set(cache.book_catalog_key(grade), build, cache.TTL_LONG)
        return Response({"books": data, "completed": completed_slugs(request.user)})
