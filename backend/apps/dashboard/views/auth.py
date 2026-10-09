"""ورود/خروج و اطلاعاتِ پایه‌ی داشبورد."""
from django.conf import settings
from django.contrib.auth import login, logout
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import exceptions
from rest_framework.authentication import CSRFCheck
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.billing.models import Plan
from apps.common.admin_site import client_ip
from apps.common.constants import GRADE_CHOICES
from apps.content.models import Podcast

from .. import audit, capabilities, login_flow
from ..payloads import full_name
from ..security import DashboardView, error, idle_seconds, mark_session
from ..segments import LAST_SEEN_LABELS, ROLE_LABELS, SUB_LABELS


def me_payload(user) -> dict:
    access = getattr(user, "staff_access", None)
    return {
        "id": user.pk,
        "name": full_name(user) or user.phone,
        "phone": login_flow.mask(user.phone),
        "is_superuser": user.is_superuser,
        "title": "مدیرِ کل" if user.is_superuser else (access.title if access else "کارمند"),
        "capabilities": capabilities.of(user),
        "idle_minutes": idle_seconds() // 60,
    }


class PublicAuthView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if request.method == "POST":
            # همان CSRFِ جنگو، ولی خطا به‌شکلِ JSON (نه صفحه‌ی HTMLِ ۴۰۳)
            check = CSRFCheck(lambda req: None)
            check.process_request(request._request)
            if check.process_view(request._request, None, (), {}) is not None:
                raise exceptions.PermissionDenied("صفحه کهنه شده است؛ یک بار صفحه را تازه کنید.")

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response["Cache-Control"] = "no-store"
        response["X-Robots-Tag"] = "noindex, nofollow"
        return response


def _sign_in(request, user, **details) -> Response:
    """نشستِ داشبورد بعد از گذشتن از همه‌ی مرحله‌های ورود."""
    login(request._request, user, backend="django.contrib.auth.backends.ModelBackend")
    mark_session(request._request)
    audit.record(request, "login", actor=user, details=details or None)
    return Response(me_payload(user))


def _login_error(exc: login_flow.LoginError):
    response = error(exc.message, exc.status)
    if exc.retry_after:
        response["Retry-After"] = str(exc.retry_after)
    return response


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CsrfView(PublicAuthView):
    """GET — کوکیِ csrftoken را می‌گذارد؛ اپ پیش از هر POST صدایش می‌زند."""

    def get(self, request):
        return Response({"ok": True})


class LoginView(PublicAuthView):
    """
    POST {phone, password} — مرحله‌ی اول؛ کدِ پیامکی می‌فرستد ({challenge, …}).
    اگر DASHBOARD_LOGIN_SMS خاموش باشد همین‌جا وارد می‌شود و «من» را برمی‌گرداند.
    """

    def post(self, request):
        ip = client_ip(request)
        try:
            user = login_flow.check_password_step(request.data.get("phone", ""), request.data.get("password", ""), ip)
            if not settings.DASHBOARD_LOGIN_SMS:
                return _sign_in(request, user, method="password")
            out = login_flow.start_challenge(user, ip)
        except login_flow.LoginError as exc:
            if exc.status in (400, 429):
                audit.record(request, "login_failed", actor=None,
                             details={"phone": login_flow.mask(str(request.data.get("phone", ""))), "why": exc.message})
            return _login_error(exc)
        return Response(out)


class ResendView(PublicAuthView):
    def post(self, request):
        try:
            return Response(login_flow.resend(request.data.get("challenge", "")))
        except login_flow.LoginError as exc:
            return _login_error(exc)


class VerifyView(PublicAuthView):
    """POST {challenge, code} — مرحله‌ی دوم؛ نشستِ داشبورد ساخته می‌شود."""

    def post(self, request):
        try:
            user = login_flow.verify(request.data.get("challenge", ""), request.data.get("code", ""))
        except login_flow.LoginError as exc:
            return _login_error(exc)
        return _sign_in(request, user)


class LogoutView(DashboardView):
    def post(self, request):
        audit.record(request, "logout")
        logout(request._request)
        return Response({"ok": True})


class MeView(DashboardView):
    def get(self, request):
        return Response(me_payload(request.user))


class MetaView(DashboardView):
    """برچسب‌ها و فهرست‌هایی که فرم‌ها و فیلترها لازم دارند."""

    def get(self, request):
        return Response({
            "capabilities": [{"key": k, "label": v[0], "description": v[1]}
                             for k, v in capabilities.CAPABILITIES.items()],
            "grades": [{"value": v, "label": label} for v, label in GRADE_CHOICES],
            "roles": [{"value": k, "label": v} for k, v in ROLE_LABELS.items()],
            "subscription_statuses": [{"value": k, "label": v} for k, v in SUB_LABELS.items()],
            "last_seen": [{"value": k, "label": v} for k, v in LAST_SEEN_LABELS.items()],
            "plans": [{"code": p.code, "title": p.title, "days": p.duration_days, "price_toman": p.price_toman}
                      for p in Plan.objects.filter(is_active=True).order_by("duration_days")],
            "podcast_icons": [{"value": v, "label": label} for v, label in Podcast.Icon.choices],
            "podcast_categories": sorted(set(Podcast.SUGGESTED_CATEGORIES)
                                         | set(Podcast.objects.values_list("category", flat=True))),
            "audit_actions": [{"value": k, "label": v} for k, v in audit.ACTIONS.items()],
        })
