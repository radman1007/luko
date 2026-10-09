"""کاربران: فهرست با فیلتر، جزئیات و چند کارِ پشتیبانی."""
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework.response import Response

from apps.accounts.models import User
from apps.accounts.sessions import end_session
from apps.common.constants import GRADE_CHOICES

from .. import audit
from ..payloads import detail, full_name, rows
from ..security import DashboardView, error, paginate
from ..segments import filter_users

FILTER_KEYS = ("role", "q", "grade", "sub", "seen", "platform", "joined_from", "joined_to",
               "verified", "has_children", "active", "ids", "order")


def filter_params(source) -> dict:
    return {key: source.get(key) for key in FILTER_KEYS if source.get(key) not in (None, "")}


class UserListView(DashboardView):
    capability = "users_view"

    def get(self, request):
        now = timezone.now()
        qs = filter_users(filter_params(request.query_params), now=now)
        summary = qs.aggregate(
            students=Count("pk", filter=Q(role=User.Role.STUDENT, is_staff=False)),
            parents=Count("pk", filter=Q(role=User.Role.PARENT, is_staff=False)),
        )
        page, meta = paginate(request, qs.select_related("staff_access"))
        return Response({"results": rows(page, now), **meta, "summary": summary})


def _get_user(pk):
    return User.objects.select_related("staff_access").filter(pk=pk).first()


class UserDetailView(DashboardView):
    capability = {"GET": "users_view", "PATCH": "users_edit"}

    def get(self, request, pk):
        user = _get_user(pk)
        if user is None:
            return error("کاربر پیدا نشد.", 404)
        return Response(detail(user, timezone.now(), request.user))

    def patch(self, request, pk):
        user = _get_user(pk)
        if user is None:
            return error("کاربر پیدا نشد.", 404)
        if (user.is_staff or user.is_superuser) and not request.user.is_superuser:
            return error("حسابِ تیم را فقط مدیرِ کل ویرایش می‌کند.", 403)
        changes = {}
        for field in ("first_name", "last_name"):
            if field in request.data:
                value = str(request.data.get(field) or "").strip()[:60]
                if value != getattr(user, field):
                    changes[field] = [getattr(user, field), value]
                    setattr(user, field, value)
        if "grade" in request.data and user.role == User.Role.STUDENT:
            try:
                grade = int(request.data.get("grade"))
            except (TypeError, ValueError):
                return error("پایه‌ی نامعتبر.")
            if grade not in dict(GRADE_CHOICES):
                return error("پایه‌ی نامعتبر.")
            if grade != user.grade:
                changes["grade"] = [user.grade, grade]
                user.grade = grade
        if "is_active" in request.data:
            active = bool(request.data.get("is_active"))
            if user.pk == request.user.pk and not active:
                return error("نمی‌توانید حسابِ خودتان را غیرفعال کنید.")
            if active != user.is_active:
                changes["is_active"] = [user.is_active, active]
                user.is_active = active
        if changes:
            user.save()
            if changes.get("is_active") == [True, False]:
                end_session(user)                  # حسابِ بسته‌شده همان لحظه بیرون برود
            audit.record(request, "user_edit", target=user, target_type="user",
                         target_label=full_name(user) or user.phone, details=changes)
        return Response(detail(_get_user(pk), timezone.now(), request.user))


class UserLogoutAllView(DashboardView):
    """POST — همه‌ی نشست‌های این کاربر در اپ بسته می‌شود (گوشیِ گم‌شده، رمزِ لورفته)."""

    capability = "users_edit"

    def post(self, request, pk):
        user = _get_user(pk)
        if user is None:
            return error("کاربر پیدا نشد.", 404)
        if (user.is_staff or user.is_superuser) and not request.user.is_superuser:
            return error("حسابِ تیم را فقط مدیرِ کل ویرایش می‌کند.", 403)
        end_session(user)
        audit.record(request, "user_logout_all", target=user, target_type="user",
                     target_label=full_name(user) or user.phone)
        return Response({"ok": True})
