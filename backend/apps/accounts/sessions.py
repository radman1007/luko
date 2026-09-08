"""
نشستِ تک‌دستگاهی.

خواسته‌ی محصول این است: بچه بعد از ورود دو هفته وارد بماند، ولی اگر با
گوشیِ دیگری وارد شد، نشستِ گوشیِ قبلی بسته شود.

راهش یک شمارنده روی خودِ کاربر است (`session_version`). هر ورودِ موفق
یکی جلویش می‌برد و همان عدد داخلِ توکن می‌نشیند؛ هر درخواست عدد را با
دیتابیس می‌سنجد و توکنِ عقب‌مانده رد می‌شود.

چرا این و نه فهرستِ سیاهِ توکن‌ها: بلک‌لیستِ SimpleJWT به‌ازای هر توکن یک
ردیف می‌سازد و باید مرتب هرس شود. این‌جا یک عدد روی کاربر کافی است، چون
سیاست ساده است — «فقط آخرین ورود معتبر است».
"""
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import AuthenticationFailed
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User

#: نامِ ادعا داخلِ توکن. کوتاه است چون در هر درخواست جابه‌جا می‌شود.
SESSION_CLAIM = "sv"


def new_session(user: User) -> RefreshToken:
    """
    یک نشستِ تازه باز می‌کند و نشست‌های قبلی را می‌بندد.

    شمارنده با `F` جلو می‌رود تا دو ورودِ هم‌زمان روی هم ننویسند.
    """
    from django.db.models import F

    User.objects.filter(pk=user.pk).update(session_version=F("session_version") + 1)
    user.refresh_from_db(fields=["session_version"])

    token = RefreshToken.for_user(user)
    token[SESSION_CLAIM] = user.session_version
    return token


def keep_session(user: User) -> RefreshToken:
    """
    توکنِ تازه روی همان نشست — بدونِ بستنِ دستگاه‌های دیگر.

    برای جاهایی است که کاربر همین حالا وارد است و فقط توکن می‌خواهد
    (مثلِ تمدید)، وگرنه تمدید خودش نشست را می‌بست.
    """
    token = RefreshToken.for_user(user)
    token[SESSION_CLAIM] = user.session_version
    return token


class SessionAwareJWTAuthentication(JWTAuthentication):
    """
    همان احرازِ SimpleJWT، به‌علاوه‌ی بررسیِ نسخه‌ی نشست.

    توکنی که نسخه‌اش از کاربر عقب‌تر باشد یعنی جای دیگری وارد شده‌اند؛
    رد می‌شود تا دستگاهِ قبلی بیرون بیفتد.
    """

    def get_user(self, validated_token):
        user = super().get_user(validated_token)

        version = validated_token.get(SESSION_CLAIM)
        # توکن‌های صادرشده پیش از این قابلیت ادعا ندارند. بیرون‌انداختنشان
        # یعنی همه‌ی کاربرانِ فعلی یک‌باره لاگ‌اوت شوند؛ به‌جایش تا انقضای
        # طبیعی‌شان معتبر می‌مانند و ورودِ بعدی نسخه‌دار می‌شود.
        if version is None:
            return user

        if int(version) != user.session_version:
            raise AuthenticationFailed(
                "از دستگاهِ دیگری وارد شده‌ای؛ دوباره وارد شو.", code="session_superseded"
            )
        return user
