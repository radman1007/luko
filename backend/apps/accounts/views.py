import logging

from django.conf import settings
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from apps.common import cache
from apps.common.sms import SmsError

from .constants import BUILDER_PRICES, CUSTOM_CHARACTER
from .models import User
from .otp import (
    OTPIPBlocked,
    OTPRateLimited,
    OTPTooManyAttempts,
    check_ip_quota,
    request_otp,
    verify_otp,
)
from .serializers import (
    KidSettingsSerializer,
    LukorianSerializer,
    RequestOTPSerializer,
    UserSerializer,
    VerifyOTPSerializer,
)
from .services import build_profile_stats, get_profile_stats

log = logging.getLogger("luko.auth")


def _client_ip(request) -> str:
    """پشتِ nginx، IP واقعی در اولین مقدارِ X-Forwarded-For است."""
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "")


def _tokens_for(user):
    refresh = RefreshToken.for_user(user)
    return {"accessToken": str(refresh.access_token), "refreshToken": str(refresh)}


def _auth_payload(user, is_new=False):
    return {**_tokens_for(user), "user": UserSerializer(user).data, "isNew": is_new}


class RequestOTPView(APIView):
    """گامِ ۱ ورود/ثبت‌نام: ارسالِ رمزِ یکبارمصرف به شماره."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RequestOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        phone = serializer.validated_data["phone"]

        try:
            check_ip_quota(_client_ip(request))
        except OTPIPBlocked as exc:
            return Response(
                {"error": {"code": 429, "message": "درخواستِ زیادی از این دستگاه ثبت شده؛ بعداً تلاش کن.",
                           "retryAfter": exc.args[0] if exc.args else 3600}},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        try:
            info = request_otp(phone)
        except OTPRateLimited as exc:
            resend_in = exc.args[0] if exc.args else 60
            return Response(
                {"error": {"code": 429, "message": "کد به‌تازگی ارسال شده؛ کمی صبر کن.",
                           "resendIn": resend_in}},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
        except SmsError as exc:
            # جزئیاتِ فنی فقط در لاگ می‌ماند؛ کاربر پیامِ ساده می‌بیند
            log.error("ارسال OTP ناموفق برای %s — %s", phone, exc.detail)
            return Response(
                {"error": {"code": 502, "message": exc.message}},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        payload = {"expiresIn": info["ttl"], "resendIn": info["resend_in"]}
        if settings.OTP_EXPOSE_DEV_CODE and settings.DEBUG:
            payload["devCode"] = info["code"]  # فقط در حالتِ توسعه، برای تست
        return Response(payload)


class VerifyOTPView(APIView):
    """گامِ ۲: بررسیِ کد. اگر حساب نبود ساخته می‌شود (ورود و ثبت‌نام یکپارچه)."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = VerifyOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        phone = data["phone"]

        try:
            ok = verify_otp(phone, data["code"])
        except OTPTooManyAttempts:
            return Response(
                {"error": {"code": 400, "message": "چند بار اشتباه زدی؛ کدِ تازه بگیر."}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not ok:
            return Response(
                {"error": {"code": 400, "message": "کد اشتباه یا منقضی شده."}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # نقش فقط هنگامِ ساختِ حسابِ تازه اعمال می‌شود؛ حسابِ موجود نقشش عوض
        # نمی‌شود (وگرنه یک دانش‌آموز می‌توانست با ورود از صفحه‌ی والدین، والد شود).
        requested_role = data.get("role") or User.Role.STUDENT
        user, is_new = User.objects.get_or_create(
            phone=phone,
            defaults={
                "role": requested_role,
                "first_name": data.get("first_name", "") or "",
                "last_name": data.get("last_name", "") or "",
            },
        )
        if is_new:
            user.set_unusable_password()  # ورود فقط با OTP
            user.save(update_fields=["password"])
        return Response(_auth_payload(user, is_new),
                        status=status.HTTP_201_CREATED if is_new else status.HTTP_200_OK)


class RefreshView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        token = request.data.get("refreshToken") or request.data.get("refresh")
        try:
            refresh = RefreshToken(token)
        except TokenError:
            return Response(
                {"error": {"code": 401, "message": "توکن تمدید نامعتبر است."}},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        return Response({"accessToken": str(refresh.access_token)})


class LogoutView(APIView):
    """خروج: توکنِ کوتاه‌عمرِ access سمت کلاینت پاک می‌شود؛ اینجا فقط تأیید می‌کنیم."""

    def post(self, request):
        return Response({"success": True})


class MeView(APIView):
    def get(self, request):
        return Response(UserSerializer(request.user).data)


class ProfileStatsView(APIView):
    """آمار واقعیِ صفحه‌ی پروفایل — سکه/امتیاز/بازی/مدال/استریک/گنج/لوکوریان."""

    def get(self, request):
        return Response(get_profile_stats(request.user))


class SettingsView(APIView):
    def get(self, request):
        return Response(KidSettingsSerializer(request.user.settings).data)

    def patch(self, request):
        serializer = KidSettingsSerializer(
            request.user.settings, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class TreasureView(APIView):
    """موجودی گنج (فقط خواندن؛ کسبِ گنج سمت سرور از دستاوردها انجام می‌شود)."""

    def get(self, request):
        return Response({"treasures": request.user.profile.treasures})


class LukorianView(APIView):
    def get(self, request):
        return Response(LukorianSerializer(request.user.lukorian).data)

    def patch(self, request):
        """ذخیره‌ی پیکربندی/ساختِ کاراکتر (فقط اگر کارگاه باز شده باشد)."""
        luk = request.user.lukorian
        if not luk.unlocked:
            return Response(
                {"error": {"code": 403, "message": "هنوز کارگاه برایت باز نشده."}},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = LukorianSerializer(luk, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class LukorianUnlockView(APIView):
    """باز کردن کارگاه — فقط اگر همه‌ی آستانه‌ها (سکه/مأموریت/استریک/بازی) برقرار باشد."""

    def post(self, request):
        stats = build_profile_stats(request.user)
        if not stats["builderUnlock"]["canUnlock"]:
            return Response(
                {"error": {"code": 403, "message": "هنوز شرط‌های باز شدن کارگاه کامل نیست.",
                           "details": stats["builderUnlock"]}},
                status=status.HTTP_403_FORBIDDEN,
            )
        luk = request.user.lukorian
        luk.unlocked = True
        luk.save(update_fields=["unlocked", "updated_at"])
        cache.invalidate(cache.profile_key(request.user.id))
        return Response(LukorianSerializer(luk).data)


class LukorianBuyView(APIView):
    """خرید آیتم ظاهری با گنج — قیمت‌ها سمت سرور، اعتبارسنجی موجودی."""

    def post(self, request):
        item = request.data.get("item")
        price = BUILDER_PRICES.get(item)
        if price is None:
            return Response(
                {"error": {"code": 400, "message": "آیتم نامعتبر."}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        profile = request.user.profile
        luk = request.user.lukorian
        if item in luk.owned_items:
            return Response(LukorianSerializer(luk).data)  # قبلاً خریده
        if profile.treasures < price:
            return Response(
                {"error": {"code": 400, "message": "گنج کافی نداری."}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        profile.treasures -= price
        profile.save(update_fields=["treasures", "updated_at"])
        luk.owned_items = [*luk.owned_items, item]
        luk.save(update_fields=["owned_items", "updated_at"])
        cache.invalidate(cache.profile_key(request.user.id))
        return Response(LukorianSerializer(luk).data)


class LukorianCustomRequestView(APIView):
    """درخواستِ ساخت کاراکتر از عکس بچه — گران، سمت سرور کسر می‌شود."""

    def post(self, request):
        profile = request.user.profile
        luk = request.user.lukorian
        price = CUSTOM_CHARACTER["priceTreasure"]
        if luk.custom_status != luk.CustomStatus.NONE:
            return Response(LukorianSerializer(luk).data)
        if profile.treasures < price:
            return Response(
                {"error": {"code": 400, "message": "گنج کافی نداری."}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        profile.treasures -= price
        profile.save(update_fields=["treasures", "updated_at"])
        luk.custom_status = luk.CustomStatus.REQUESTED
        luk.save(update_fields=["custom_status", "updated_at"])
        cache.invalidate(cache.profile_key(request.user.id))
        return Response(
            {**LukorianSerializer(luk).data, "deliveryDays": CUSTOM_CHARACTER["deliveryDays"]}
        )
