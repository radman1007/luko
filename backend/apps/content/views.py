"""
APIهای محتوا. «امروز» تاریخ‌محور است (نه تصادفی) تا همه‌ی بچه‌ها در یک روز
یک قانون/خوراکی ببینند و گزارشِ والدین معنا داشته باشد.
"""
from datetime import date

from django.db.models import F
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Podcast, PodcastListen, Recipe, TrafficRule, Video, VideoInteraction
from .serializers import (
    InteractionSerializer,
    ListenSerializer,
    PodcastSerializer,
    RecipeSerializer,
    TrafficRuleSerializer,
    VideoSerializer,
)


def _day_index(total: int) -> int:
    """اندیسِ امروز در فهرست — بر پایه‌ی شماره‌ی روزِ سال."""
    if total <= 0:
        return 0
    today = timezone.localdate()
    return (today - date(today.year, 1, 1)).days % total


class VideoListView(APIView):
    """GET /videos?category=کارتون — فهرست ویدیوها + وضعیت لایکِ خودِ کاربر."""

    def get(self, request):
        videos = Video.objects.filter(is_active=True)
        category = request.query_params.get("category")
        if category:
            videos = videos.filter(category=category)
        liked_ids = set(
            VideoInteraction.objects.filter(user=request.user, liked=True)
            .values_list("video_id", flat=True)
        )
        data = VideoSerializer(videos, many=True, context={"liked_ids": liked_ids}).data
        categories = list(
            Video.objects.filter(is_active=True)
            .order_by().values_list("category", flat=True).distinct()
        )
        return Response({"videos": data, "categories": categories})


class VideoInteractionView(APIView):
    """POST /videos/{id}/interaction — {liked?, viewed?}"""

    def post(self, request, pk):
        serializer = InteractionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            video = Video.objects.get(pk=pk, is_active=True)
        except Video.DoesNotExist:
            return Response({"error": {"code": 404, "message": "ویدیو پیدا نشد."}},
                            status=status.HTTP_404_NOT_FOUND)

        interaction, created = VideoInteraction.objects.get_or_create(
            user=request.user, video=video
        )
        changed = []
        if "liked" in serializer.validated_data:
            interaction.liked = serializer.validated_data["liked"]
            changed.append("liked")
        if serializer.validated_data.get("viewed") and not interaction.viewed:
            interaction.viewed = True
            changed.append("viewed")
            Video.objects.filter(pk=video.pk).update(views=F("views") + 1)
        if changed:
            interaction.save(update_fields=[*changed, "updated_at"])

        video.refresh_from_db(fields=["views"])
        return Response({"liked": interaction.liked, "viewed": interaction.viewed,
                         "views": video.views})


def _playable_podcasts():
    """فقط قسمت‌هایی که صدا دارند؛ ردیفِ بی‌فایل در سایت دکمه‌ی پخشِ مرده می‌شد."""
    return Podcast.objects.filter(is_active=True).exclude(audio_file="", audio_url="")


class PodcastListView(APIView):
    """
    GET /podcasts — فهرست + «پادکست امروز».

    عمومی است (مثلِ قانون‌ها و خوراکی‌ها) تا حالتِ مهمان هم پادکستِ واقعی بشنود؛
    «گوش‌داده‌شده» فقط برای کاربرِ واردشده از سرور می‌آید.
    """

    permission_classes = [AllowAny]

    def get(self, request):
        episodes = list(_playable_podcasts())
        listened_ids = set()
        if request.user.is_authenticated:
            listened_ids = set(
                PodcastListen.objects.filter(user=request.user)
                .values_list("podcast_id", flat=True)
            )
        context = {"listened_ids": listened_ids, "request": request}
        today = episodes[_day_index(len(episodes))] if episodes else None
        categories = list(dict.fromkeys(e.category for e in episodes))
        return Response({
            "episodes": PodcastSerializer(episodes, many=True, context=context).data,
            "today": PodcastSerializer(today, context=context).data if today else None,
            "categories": categories,
        })


class PodcastListenView(APIView):
    """POST /podcasts/{id}/listen — {seconds?}"""

    def post(self, request, pk):
        serializer = ListenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            podcast = _playable_podcasts().get(pk=pk)
        except Podcast.DoesNotExist:
            return Response({"error": {"code": 404, "message": "پادکست پیدا نشد."}},
                            status=status.HTTP_404_NOT_FOUND)
        PodcastListen.objects.create(
            user=request.user, podcast=podcast,
            seconds=serializer.validated_data.get("seconds", 0),
        )
        return Response({"ok": True})


class TrafficRuleView(APIView):
    """GET /traffic-rules — همه + قانونِ امروز."""

    permission_classes = [AllowAny]

    def get(self, request):
        rules = list(TrafficRule.objects.filter(is_active=True))
        today = rules[_day_index(len(rules))] if rules else None
        return Response({
            "rules": TrafficRuleSerializer(rules, many=True).data,
            "today": TrafficRuleSerializer(today).data if today else None,
        })


class RecipeView(APIView):
    """GET /recipes — همه + خوراکیِ امروز."""

    permission_classes = [AllowAny]

    def get(self, request):
        recipes = list(Recipe.objects.filter(is_active=True))
        today = recipes[_day_index(len(recipes))] if recipes else None
        return Response({
            "recipes": RecipeSerializer(recipes, many=True).data,
            "today": RecipeSerializer(today).data if today else None,
        })
