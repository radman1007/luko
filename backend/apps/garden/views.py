from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common import cache

from .models import GardenShopItem
from .serializers import GardenShopItemSerializer
from .services import (
    GardenError,
    buy,
    fertilize_all,
    get_state_view,
    plant_seed,
    water_all,
)


class _GardenActionView(APIView):
    """پایه‌ی اکشن‌های باغچه: GardenError را به خطای ۴۰۰ با پیامِ فارسی تبدیل می‌کند."""

    action = None

    def post(self, request, *args, **kwargs):
        try:
            return Response(self.run(request))
        except GardenError as exc:
            return Response(
                {"error": {"code": 400, "message": str(exc)}},
                status=status.HTTP_400_BAD_REQUEST,
            )

    def run(self, request):  # pragma: no cover - override
        raise NotImplementedError


class GardenStateView(APIView):
    def get(self, request):
        return Response(get_state_view(request.user))


class GardenWaterView(_GardenActionView):
    def run(self, request):
        return water_all(request.user)


class GardenFertilizeView(_GardenActionView):
    def run(self, request):
        return fertilize_all(request.user)


class GardenPlantView(_GardenActionView):
    def run(self, request):
        return plant_seed(request.user)


class GardenBuyView(_GardenActionView):
    def run(self, request):
        item_key = request.data.get("itemKey") or request.data.get("item_key")
        return buy(request.user, item_key)


class GardenShopView(APIView):
    """فروشگاهِ باغچه — از پنل ادمین قابل‌افزودن/تغییر؛ فهرست cache می‌شود."""

    def get(self, request):
        data = cache.get_or_set(
            cache.catalog_key("garden_shop"),
            lambda: GardenShopItemSerializer(
                GardenShopItem.objects.filter(is_active=True), many=True
            ).data,
            cache.TTL_LONG,
        )
        return Response(data)
