"""
احراز هویت و دسترسیِ داشبورد.

- فقط نشستِ جنگو (کوکیِ httpOnly)، نه JWTِ اپ؛ پس توکنِ بچه یا والد هیچ‌وقت در
  داشبورد کار نمی‌کند.
- نشست وقتی «داشبوردی» است که از هر دو مرحله (رمز + کدِ پیامکی) گذشته باشد، یا
  نشستِ مدیرِ کلی باشد که در پنلِ جنگو وارد شده (همان کوکی؛ به خواستِ مدیر، بی‌ورودِ
  دوباره). کارمندِ عادی همیشه از ورودِ خودِ داشبورد با کدِ پیامکی می‌آید.
- بی‌کاری بیش از DASHBOARD_IDLE_MINUTES نشست را می‌بندد؛ عمرِ کلِ نشست هم سقف دارد.
- هر درخواست دوباره می‌سنجد کاربر فعال و کارمند است و این بخش را دارد.
"""
from __future__ import annotations

import math
import time

from django.conf import settings
from django.contrib.auth import logout
from djangorestframework_camel_case.parser import (
    CamelCaseFormParser,
    CamelCaseJSONParser,
    CamelCaseMultiPartParser,
)
from rest_framework import exceptions
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from . import audit, capabilities

SESSION_MARK = "dash_at"        # زمانِ ورودِ دومرحله‌ای
SESSION_SEEN = "dash_seen"      # آخرین درخواست


def idle_seconds() -> int:
    return int(getattr(settings, "DASHBOARD_IDLE_MINUTES", 30)) * 60


def max_seconds() -> int:
    return int(getattr(settings, "DASHBOARD_SESSION_HOURS", 8)) * 3600


def mark_session(request) -> None:
    now = int(time.time())
    request.session[SESSION_MARK] = now
    request.session[SESSION_SEEN] = now
    request.session.set_expiry(max_seconds())


class DashboardAuthentication(SessionAuthentication):
    def authenticate(self, request):
        result = super().authenticate(request)       # CSRF هم همین‌جا برای POST/PATCH/DELETE چک می‌شود
        if result is None:
            return None
        session = request._request.session
        started, seen = session.get(SESSION_MARK), session.get(SESSION_SEEN)
        now = int(time.time())
        if not started or not seen:
            return self._adopt(request, result)
        if now - seen > idle_seconds() or now - started > max_seconds():
            logout(request._request)
            raise exceptions.NotAuthenticated("نشست به‌خاطرِ بی‌کاری بسته شد؛ دوباره وارد شوید.")
        if now - seen >= 30:
            session[SESSION_SEEN] = now
        return result

    @staticmethod
    def _adopt(request, result):
        """نشستِ پنلِ جنگو: فقط مدیرِ کل (تنها کسی که آن پنل برایش باز است) بی‌ورودِ دوباره می‌آید."""
        user = result[0]
        if not (user.is_superuser and capabilities.of(user)):
            return None
        session = request._request.session
        session[SESSION_MARK] = session[SESSION_SEEN] = int(time.time())
        audit.record(request, "login", actor=user, details={"method": "admin_session"})
        return result

    def authenticate_header(self, request):
        # تا DRF به‌جای ۴۰۳ برای «وارد نشده» ۴۰۱ بدهد
        return "Session"


class DashboardAccess(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            raise exceptions.NotAuthenticated("برای این بخش باید وارد داشبورد شوید.")
        caps = capabilities.of(user)
        if not caps:
            raise exceptions.NotAuthenticated("این حساب به داشبورد دسترسی ندارد.")
        need = view.required_capability(request)
        if need is None:
            return True
        if need == capabilities.SUPERUSER:
            allowed = user.is_superuser
        else:
            allowed = need in caps
        if not allowed:
            raise exceptions.PermissionDenied("این بخش برای حسابِ شما باز نیست.")
        return True


class DashboardView(APIView):
    """پایه‌ی همه‌ی APIهای داشبورد."""

    authentication_classes = [DashboardAuthentication]
    permission_classes = [DashboardAccess]
    parser_classes = [CamelCaseJSONParser, CamelCaseMultiPartParser, CamelCaseFormParser]
    #: دسترسیِ لازم؛ یا دیکشنریِ {متد: دسترسی} وقتی خواندن و نوشتن فرق دارند
    capability: str | dict | None = None

    def required_capability(self, request):
        if isinstance(self.capability, dict):
            return self.capability.get(request.method, self.capability.get("*"))
        return self.capability

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response["Cache-Control"] = "no-store"
        response["X-Robots-Tag"] = "noindex, nofollow"
        return response


def error(message: str, code: int = 400) -> Response:
    return Response({"error": {"code": code, "message": message}}, status=code)


def paginate(request, queryset, *, default: int = 25, maximum: int = 100):
    """(ردیف‌های این صفحه، {count, page, pages, pageSize})"""
    try:
        size = min(max(int(request.query_params.get("page_size", default)), 5), maximum)
    except (TypeError, ValueError):
        size = default
    count = queryset.count()
    pages = max(1, math.ceil(count / size))
    try:
        page = min(max(int(request.query_params.get("page", 1)), 1), pages)
    except (TypeError, ValueError):
        page = 1
    rows = list(queryset[(page - 1) * size: page * size])
    return rows, {"count": count, "page": page, "pages": pages, "page_size": size}
