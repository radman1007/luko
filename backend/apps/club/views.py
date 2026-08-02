from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User

from .serializers import SuggestMissionSerializer
from .services import (
    ClubError,
    complete_mission,
    get_summary,
    medals_view,
    redeem,
    shop_view,
    suggest_mission,
    todays_missions,
)
from .models import MissionTemplate


def _club_error(exc: ClubError):
    return Response(
        {"error": {"code": 400, "message": str(exc)}}, status=status.HTTP_400_BAD_REQUEST
    )


class ClubSummaryView(APIView):
    """همه‌چیزِ صفحه‌ی کلاب یک‌جا (cache‌شده): سکه، هفته، مأموریت، ورزش، مدال، فروشگاه."""

    def get(self, request):
        return Response(get_summary(request.user))


class MissionsView(APIView):
    def get(self, request):
        return Response(todays_missions(request.user, MissionTemplate.Category.MISSION))


class SportsView(APIView):
    def get(self, request):
        return Response(todays_missions(request.user, MissionTemplate.Category.SPORT))


class MedalsView(APIView):
    def get(self, request):
        return Response(medals_view(request.user))


class ShopView(APIView):
    def get(self, request):
        return Response(shop_view(request.user))


class CompleteMissionView(APIView):
    """تکمیلِ یک مأموریت/تسکِ ورزشیِ امروز — سکه و شبنم سمت سرور داده می‌شود."""

    def post(self, request, template_id: int):
        try:
            return Response(complete_mission(request.user, template_id))
        except ClubError as exc:
            return _club_error(exc)


class RedeemView(APIView):
    def post(self, request, item_key: str):
        try:
            return Response(redeem(request.user, item_key))
        except ClubError as exc:
            return _club_error(exc)


class SuggestMissionView(APIView):
    """معلم/والد مأموریتِ پیشنهادی (امتیاز بیشتر) برای بچه‌اش می‌گذارد."""

    def post(self, request):
        if request.user.role not in {User.Role.TEACHER, User.Role.PARENT} \
                and not request.user.is_staff:
            return Response(
                {"error": {"code": 403, "message": "فقط معلم یا والدین می‌توانند پیشنهاد بدهند."}},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = SuggestMissionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        child = User.objects.filter(id=data["child_id"], role=User.Role.STUDENT).first()
        if child is None:
            return Response(
                {"error": {"code": 404, "message": "دانش‌آموز پیدا نشد."}},
                status=status.HTTP_404_NOT_FOUND,
            )
        # فقط برای بچه‌ی خودش (مگر ادمین)
        if not request.user.is_staff and not request.user.children.filter(id=child.id).exists():
            return Response(
                {"error": {"code": 403, "message": "این دانش‌آموز زیرِ نظرِ تو نیست."}},
                status=status.HTTP_403_FORBIDDEN,
            )
        suggest_mission(
            request.user, child, title=data["title"],
            coin_reward=data["coin_reward"], category=data["category"],
        )
        return Response({"success": True}, status=status.HTTP_201_CREATED)
