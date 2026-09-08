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
    consume_pick_ticket,
    issue_pick_ticket,
    request_otp,
    verify_otp,
)
from .passwords import (get_or_create_account, has_password, link_family,
                        mark_phone_verified, set_password, student_by_password)
from .sessions import SESSION_CLAIM, keep_session, new_session
from .serializers import (
    KidSettingsSerializer,
    LukorianSerializer,
    MeUpdateSerializer,
    PasswordLoginSerializer,
    RegisterSerializer,
    RequestOTPSerializer,
    SetPasswordSerializer,
    StartAuthSerializer,
    UserSerializer,
    VerifyOTPSerializer,
    VerifyPhoneSerializer,
)
from .services import build_profile_stats, get_profile_stats

log = logging.getLogger("luko.auth")


def _client_ip(request) -> str:
    """پشتِ nginx، IP واقعی در اولین مقدارِ X-Forwarded-For است."""
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "")


def _tokens_for(user, fresh=True):
    """
    `fresh=True` یعنی این یک ورودِ تازه است و نشستِ دستگاه‌های قبلی را
    می‌بندد. تمدیدِ توکن با `fresh=False` می‌آید تا خودش کاربر را بیرون
    نیندازد.
    """
    refresh = new_session(user) if fresh else keep_session(user)
    return {"accessToken": str(refresh.access_token), "refreshToken": str(refresh)}


def _auth_payload(user, is_new=False, fresh=True):
    return {**_tokens_for(user, fresh), "user": UserSerializer(user).data, "isNew": is_new}


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

        # طولِ کد را سرور می‌گوید چون ارائه‌دهنده‌ها یکی نیستند؛ فرانت به
        # همین تعداد خانه می‌سازد و با عوض‌شدنِ پنلِ پیامک نمی‌شکند.
        payload = {
            "expiresIn": info["ttl"],
            "resendIn": info["resend_in"],
            "codeLength": info.get("length") or len(info["code"]),
        }
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

        # نقش بخشی از جستجوست، نه فقط پیش‌فرضِ ساخت. یعنی ورود از صفحه‌ی
        # والدین همیشه به حسابِ والدِ همان شماره می‌رسد و ورود از صفحه‌ی
        # بچه‌ها به حسابِ دانش‌آموزِ همان شماره — دو حسابِ جدا با یک شماره،
        # چون بیشترِ بچه‌ها با شماره‌ی پدر/مادرشان ثبت‌نام می‌کنند. هیچ‌کدام
        # نقشِ دیگری را عوض نمی‌کند و نقشِ کارکنان هم از اینجا ساخته نمی‌شود.
        requested_role = data.get("role") or User.Role.STUDENT

        # یک شماره می‌تواند چند بچه داشته باشد، پس کدِ درست به‌تنهایی
        # نمی‌گوید «کدام بچه». اگر بیش از یکی بود، فهرست را می‌دهیم تا
        # خودش انتخاب کند؛ بلیتِ کوتاه‌عمر ثابت می‌کند کد تأیید شده بوده.
        if requested_role == User.Role.STUDENT:
            siblings = list(User.objects.filter(phone=phone, role=User.Role.STUDENT))
            if len(siblings) > 1:
                return Response({
                    "chooseFrom": [
                        {"id": str(u.id), "firstName": u.first_name, "grade": u.grade}
                        for u in siblings
                    ],
                    "ticket": issue_pick_ticket(phone),
                })
            user = siblings[0] if siblings else None
            is_new = user is None
            if is_new:
                user, _ = get_or_create_account(
                    phone, requested_role, data.get("first_name", "") or "")
        else:
            user, is_new = User.objects.get_or_create(
                phone=phone,
                role=requested_role,
                defaults={
                    "first_name": data.get("first_name", "") or "",
                    "last_name": data.get("last_name", "") or "",
                },
            )
            if is_new:
                user.set_unusable_password()  # ورود فقط با OTP
                user.save(update_fields=["password"])
                link_family(user)

        return Response(_auth_payload(user, is_new),
                        status=status.HTTP_201_CREATED if is_new else status.HTTP_200_OK)


class OTPChooseView(APIView):
    """
    POST /auth/otp-choose — بعد از تأییدِ کد، انتخابِ اینکه کدام بچه است.

    فقط وقتی لازم می‌شود که چند بچه یک شماره داشته باشند. بلیت ثابت
    می‌کند کدِ همان شماره تازه تأیید شده، وگرنه هر کسی می‌توانست با
    دانستنِ یک شناسه وارد حسابِ دیگری شود.
    """

    permission_classes = [AllowAny]

    def post(self, request):
        ticket = request.data.get("ticket") or ""
        phone = consume_pick_ticket(ticket)
        if phone is None:
            return Response(
                {"error": {"code": 400, "message": "این مرحله منقضی شده؛ دوباره کد بگیر."}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = User.objects.filter(
            pk=request.data.get("user_id") or request.data.get("userId"),
            phone=phone, role=User.Role.STUDENT,
        ).first()
        if user is None:
            return Response(
                {"error": {"code": 404, "message": "این حساب پیدا نشد."}},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(_auth_payload(user, False))


class StartAuthView(APIView):
    """
    POST /auth/start — «این شماره حساب دارد یا نه؟»

    فرانت با همین می‌فهمد گامِ بعدی «رمزت را بزن» است یا «حساب می‌سازیم».
    عمداً چیزی جز وجود/نبودِ رمز برنمی‌گرداند.
    """

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = StartAuthSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        phone = serializer.validated_data["phone"]
        role = serializer.validated_data["role"]

        user = User.objects.filter(phone=phone, role=role).first()
        # حسابی که رمز ندارد (با OTP ساخته شده) مثل حسابِ تازه رفتار می‌کند
        return Response({"exists": bool(user and has_password(user))})


class RegisterView(APIView):
    """
    POST /auth/register — ثبت‌نام بدونِ تأییدِ شماره.

    شماره را می‌گیرد، حساب می‌سازد و همان‌جا وارد می‌کند؛ رمز را گامِ
    بعدی می‌گذارد. تأییدِ شماره بعداً و اختیاری است.
    """

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        phone = serializer.validated_data["phone"]
        role = serializer.validated_data["role"]

        # برای والد یک شماره یک حساب دارد و بس. برای دانش‌آموز، شماره‌ای
        # که قبلاً حسابِ رمزدار دارد باز هم می‌تواند بچه‌ی تازه بگیرد —
        # ولی آن کار از پنلِ والدین انجام می‌شود، نه از ثبت‌نامِ عمومی،
        # وگرنه هر کسی می‌توانست روی شماره‌ی دیگری حساب بسازد.
        if role != User.Role.STUDENT:
            found = User.objects.filter(phone=phone, role=role).first()
            if found and has_password(found):
                return Response(
                    {"error": {"code": 409,
                               "message": "این شماره از قبل حساب دارد؛ با رمزت وارد شو."}},
                    status=status.HTTP_409_CONFLICT,
                )
        elif User.objects.filter(phone=phone, role=role).exists() and not any(
            not u.has_usable_password() for u in User.objects.filter(phone=phone, role=role)
        ):
            return Response(
                {"error": {"code": 409,
                           "message": "این شماره از قبل حساب دارد؛ با رمزت وارد شو."}},
                status=status.HTTP_409_CONFLICT,
            )

        user, created = get_or_create_account(
            phone, role, serializer.validated_data.get("first_name", ""),
            grade=serializer.validated_data.get("grade"))
        return Response(_auth_payload(user, created),
                        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class PasswordLoginView(APIView):
    """POST /auth/login — ورود با شماره و رمز."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PasswordLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        phone = serializer.validated_data["phone"]
        role = serializer.validated_data["role"]

        raw = serializer.validated_data["password"]

        # دانش‌آموز: چند بچه می‌توانند یک شماره داشته باشند و رمز آن‌ها را
        # از هم جدا می‌کند، پس حساب از روی رمز پیدا می‌شود نه فقط شماره.
        if role == User.Role.STUDENT:
            user = student_by_password(phone, raw)
        else:
            found = User.objects.filter(phone=phone, role=role).first()
            user = found if found and has_password(found) and found.check_password(raw) else None

        # پیامِ یکسان برای «شماره نیست» و «رمز غلط» تا شماره‌ها لو نروند
        if user is None:
            return Response(
                {"error": {"code": 400, "message": "شماره یا رمز درست نیست."}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not user.is_active:
            return Response({"error": {"code": 403, "message": "این حساب غیرفعال است."}},
                            status=status.HTTP_403_FORBIDDEN)
        return Response(_auth_payload(user, False))


class SetPasswordView(APIView):
    """
    POST /auth/set-password — گذاشتن یا عوض‌کردنِ رمز.

    هم گامِ آخرِ ثبت‌نام است و هم مقصدِ «رمزم را فراموش کردم» (که با
    کدِ یکبارمصرف وارد شده و حالا رمزِ تازه می‌سازد).
    """

    def post(self, request):
        serializer = SetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        set_password(request.user, serializer.validated_data["password"])
        return Response(UserSerializer(request.user).data)


class VerifyPhoneView(APIView):
    """POST /auth/verify-phone — تأییدِ اختیاریِ شماره با کدِ یکبارمصرف."""

    def post(self, request):
        serializer = VerifyPhoneSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            ok = verify_otp(request.user.phone, serializer.validated_data["code"])
        except OTPTooManyAttempts:
            return Response(
                {"error": {"code": 400, "message": "چند بار اشتباه زدی؛ کدِ تازه بگیر."}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not ok:
            return Response({"error": {"code": 400, "message": "کد اشتباه یا منقضی شده."}},
                            status=status.HTTP_400_BAD_REQUEST)
        mark_phone_verified(request.user)
        return Response(UserSerializer(request.user).data)


class RefreshView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        # پارسر کلیدهای ورودی را snake_case می‌کند، پس `refreshToken` هرگز
        # خوانده نمی‌شد. بدترش این بود که `RefreshToken(None)` خطا نمی‌دهد و
        # یک توکنِ خالیِ تازه می‌سازد — یعنی این مسیر هیچ چیزی را تأیید
        # نمی‌کرد. توکنِ نبود باید صریح رد شود.
        token = (request.data.get("refresh_token") or request.data.get("refreshToken")
                 or request.data.get("refresh"))
        if not token:
            return Response(
                {"error": {"code": 401, "message": "توکن تمدید نامعتبر است."}},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        try:
            refresh = RefreshToken(token)
        except TokenError:
            return Response(
                {"error": {"code": 401, "message": "توکن تمدید نامعتبر است."}},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # نشست ممکن است جای دیگری تازه شده باشد. بدونِ این بررسی، توکنِ
        # دستگاهِ قدیمی تا دو هفته می‌توانست توکنِ دسترسیِ تازه بگیرد.
        version = refresh.get(SESSION_CLAIM)
        if version is not None:
            user = User.objects.filter(pk=refresh.get("user_id")).first()
            if user is None or int(version) != user.session_version:
                return Response(
                    {"error": {"code": 401,
                               "message": "از دستگاهِ دیگری وارد شده‌ای؛ دوباره وارد شو."}},
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

    def patch(self, request):
        """تکمیلِ نام بعد از ثبت‌نام (گامِ آخرِ ورود با پیامک)."""
        serializer = MeUpdateSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
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
