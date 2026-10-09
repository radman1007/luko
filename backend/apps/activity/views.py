from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .services import record_beat


class BeatView(APIView):
    """
    POST /presence/beat {platform: web|android, device}

    صفحه‌ی باز و دیده‌شده دقیقه‌ای یک‌بار می‌فرستد. مهمان هم (با شناسه‌ی دستگاه)
    تا «بازدیدکننده‌ی مهمان» هم شمرده شود. سقف برای هر IP بالاست چون یک مدرسه
    ممکن است پشتِ یک IP باشد.
    """

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "presence"

    def post(self, request):
        user = request.user if request.user.is_authenticated else None
        ok = record_beat(user=user, device=str(request.data.get("device") or ""),
                         platform=str(request.data.get("platform") or ""))
        if not ok:
            return Response({"error": {"code": 400, "message": "ضربانِ نامعتبر."}},
                            status=status.HTTP_400_BAD_REQUEST)
        return Response({"ok": True})
