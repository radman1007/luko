from rest_framework import status
from rest_framework.generics import ListAPIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, BasePermission
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.parent.services import invalidate_child_report

from .models import Book, Game, SeasonMemory
from .serializers import BookSerializer, GameSerializer, SeasonMemorySerializer
from .telemetry import MAX_BATCH, store_events
from apps.common import cache
from apps.common.constants import GRADE_CHOICES

from .playlink import sign
from .services import (GameUnavailable, StageLocked, blocking_stage, complete_game,
                       completed_slugs, game_path, grades_with_games, is_first_stage,
                       star_map)

_GRADES = {value for value, _ in GRADE_CHOICES}
_NOT_FOUND = {"error": {"code": 404, "message": "این بازی وجود ندارد."}}


class GameListView(ListAPIView):
    """کاتالوگِ بازی‌ها (فیلترِ کتاب اختیاری)."""
    serializer_class = GameSerializer
    queryset = Game.objects.playable()
    filterset_fields = ["book_id"]
    pagination_class = None


class GamePathView(APIView):
    """
    GET /games/path?grade=1 — مسیرِ بازی‌های یک کلاس برای صفحه‌ی بچه.

    فقط عنوان، ترتیب، هفته و پاداش؛ هیچ اسمی از کتاب یا درس در آن نیست.
    بدونِ `grade`، کلاسِ خودِ کاربر (و برای مهمان کلاسِ اول).
    """

    permission_classes = [AllowAny]

    def get(self, request):
        raw = request.query_params.get("grade")
        if raw is None:
            grade = getattr(request.user, "grade", None) or 1
        else:
            try:
                grade = int(raw)
            except ValueError:
                grade = 0
        if grade not in _GRADES:
            return Response(
                {"error": {"code": 400, "message": "کلاس معتبر نیست."}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        stages = cache.get_or_set(cache.game_path_key(str(grade)),
                                  lambda: game_path(grade), cache.TTL_LONG)
        return Response({"grade": grade, "stages": stages})


class OpenGradesView(APIView):
    """
    GET /games/grades — کلاس‌هایی که بازی دارند.

    فرمِ ثبت‌نام قبلاً فهرستِ ثابتی در کد داشت؛ با رسیدنِ بازی‌های کلاس‌های
    تازه، آن فهرست کهنه می‌شد و بچه پایه‌ی خودش را پیدا نمی‌کرد.
    """

    permission_classes = [AllowAny]

    def get(self, request):
        grades = cache.get_or_set(cache.game_path_key("grades"),
                                  grades_with_games, cache.TTL_LONG)
        return Response({"grades": grades})


class GameCompleteView(APIView):
    """POST /games/<slug>/complete — پاداش سمت سرور محاسبه می‌شود."""

    def post(self, request, slug):
        # ستاره اختیاری است: بازی‌هایی که هنوز مهاجرت نکرده‌اند چیزی
        # نمی‌فرستند و تکمیل مثلِ قبل ثبت می‌شود.
        raw = request.data.get("stars") if isinstance(request.data, dict) else None
        try:
            stars = int(raw) if raw is not None else None
        except (TypeError, ValueError):
            stars = None
        try:
            result = complete_game(request.user, slug, stars=stars)
        except GameUnavailable:
            return Response(_NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
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
        game = Game.objects.playable().filter(slug=slug).first()
        if game is None or not game.game_file:
            return Response(_NOT_FOUND, status=status.HTTP_404_NOT_FOUND)

        if not request.user.is_authenticated:
            # بدونِ حساب فقط مرحله‌ی اولِ مسیرِ هر کلاس باز است (حالتِ مهمان/نمایش)
            if not is_first_stage(game):
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


class IsStudent(BasePermission):
    message = "رویدادِ بازی فقط از حسابِ دانش‌آموز پذیرفته می‌شود."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == "student")


class GameEventView(APIView):
    """
    POST /games/events — رویدادهای داخلِ بازی (قراردادِ نسخه‌ی ۳: docs/event-tracking-guide.md).

    یک رویداد یا فهرستی تا MAX_BATCH. با یک INSERT ذخیره می‌شود تا بازی و سرور
    هیچ‌کدام منتظر نمانند؛ رویدادِ خراب کنار می‌رود و بقیه ثبت می‌شوند.
    """

    permission_classes = [IsStudent]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "game_events"

    def post(self, request):
        items = request.data if isinstance(request.data, list) else [request.data]
        if len(items) > MAX_BATCH:
            return Response(
                {"error": {"code": 413, "message": f"در هر درخواست حداکثر {MAX_BATCH} رویداد."}},
                status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            )
        accepted, rejected = store_events(request.user, items)
        if accepted:
            # گزارشِ والد از همین رویدادها ساخته می‌شود؛ پس کشِ آن باید بیفتد
            invalidate_child_report(request.user.id)
        return Response({"stored": accepted, "rejected": rejected})


class CompletedGamesView(APIView):
    """
    GET /games/completed — فقط شناسه‌ی مرحله‌های تمام‌شده.

    نقشه‌ی سیزن همین را می‌خواهد و بس. تا دیروز برای گرفتنش کلِ کاتالوگ
    (چهار کتاب و ۲۷ مرحله) سریالایز و فرستاده می‌شد؛ همان مسیر کندترین
    نقطه‌ی APIها بود.
    """

    def get(self, request):
        # `completed` عمداً همان آرایه‌ی رشته می‌ماند — نقشه و کارت‌های خانه
        # رویش بسته‌اند. ستاره‌ها کنارش می‌آیند تا چیزی نشکند.
        return Response({
            "completed": completed_slugs(request.user),
            "stars": star_map(request.user),
        })


class BookListView(APIView):
    """GET /books — کاتالوگِ کتاب‌ها با مراحل (جایگزینِ booksData ثابتِ فرانت)."""

    def get(self, request):
        grade = request.query_params.get("grade")

        def build():
            books = Book.objects.filter(is_active=True)
            if grade:
                books = books.filter(grade=grade)
            games_by_book: dict = {}
            for game in Game.objects.playable():
                games_by_book.setdefault(game.book_id, []).append(game)
            return BookSerializer(books, many=True,
                                  context={"games_by_book": games_by_book}).data

        # کاتالوگ برای همه یکی است و فقط با ویرایشِ ادمین عوض می‌شود
        data = cache.get_or_set(cache.book_catalog_key(grade), build, cache.TTL_LONG)
        return Response({"books": data, "completed": completed_slugs(request.user)})


class SeasonMemoryListCreateView(APIView):
    """
    GET/POST /games/memories — یادگاری‌های نقشه‌ی سیزن.

    فهرست فقط بندانگشتی می‌دهد تا نقشه سبک بماند؛ تصویرِ کامل مسیرِ
    جداگانه دارد. هر نقطه یک یادگاری دارد و عکسِ تازه جای قبلی را می‌گیرد.
    """

    def get(self, request):
        rows = SeasonMemory.objects.filter(user=request.user)
        season = request.query_params.get("seasonId")
        if season:
            rows = rows.filter(season_id=season)
        return Response({"memories": SeasonMemorySerializer(rows, many=True).data})

    def post(self, request):
        serializer = SeasonMemorySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        memory, _ = SeasonMemory.objects.update_or_create(
            user=request.user,
            season_id=data["season_id"],
            spot_id=data["spot_id"],
            defaults={"thumbnail": data.get("thumbnail", ""),
                      "image": data.get("image", "")},
        )
        return Response(SeasonMemorySerializer(memory).data,
                        status=status.HTTP_201_CREATED)


class SeasonMemoryImageView(APIView):
    """GET /games/memories/<pk>/image — تصویرِ کامل، فقط برای صاحبش."""

    def get(self, request, pk):
        memory = SeasonMemory.objects.filter(user=request.user, pk=pk).first()
        if memory is None:
            return Response({"error": {"code": 404, "message": "پیدا نشد."}},
                            status=status.HTTP_404_NOT_FOUND)
        return Response({"image": memory.image})


class SeasonMemoryDestroyView(APIView):
    """DELETE /games/memories/<pk> — پاک‌کردنِ یادگاری."""

    def delete(self, request, pk):
        SeasonMemory.objects.filter(user=request.user, pk=pk).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
