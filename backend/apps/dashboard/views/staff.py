"""کارمندان و دسترسی‌ها — فقط مدیرِ کل."""
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.response import Response

from apps.accounts.models import User
from apps.accounts.utils import normalize_phone

from .. import audit, capabilities
from ..models import StaffAccess
from ..payloads import fa_stamp, full_name, last_seen
from ..security import DashboardView, error

MIN_PASSWORD = 10


def staff_row(user: User, now) -> dict:
    access = getattr(user, "staff_access", None)
    return {
        "id": user.pk,
        "name": full_name(user) or "بی‌نام",
        "first_name": user.first_name,
        "last_name": user.last_name,
        "phone": user.phone,
        "is_superuser": user.is_superuser,
        "is_active": user.is_active,
        "title": "مدیرِ کل" if user.is_superuser else (access.title if access else ""),
        "capabilities": capabilities.of(user) if user.is_active else (capabilities.clean(access.capabilities)
                                                                       if access else []),
        "last_login_fa": fa_stamp(user.last_login),
        "last_seen": last_seen(user, now),
        "created_fa": fa_stamp(user.date_joined),
    }


def check_password_rules(raw: str, user: User | None = None) -> str | None:
    raw = raw or ""
    if len(raw) < MIN_PASSWORD:
        return f"رمز باید دست‌کم {MIN_PASSWORD} نویسه باشد."
    if raw.isdigit():
        return "رمز نباید فقط عدد باشد."
    try:
        validate_password(raw, user)
    except ValidationError as exc:
        return " ".join(exc.messages)
    return None


class StaffListView(DashboardView):
    capability = capabilities.SUPERUSER

    def get(self, request):
        now = timezone.now()
        users = User.objects.filter(is_staff=True).select_related("staff_access").order_by("-is_superuser", "pk")
        return Response({"results": [staff_row(u, now) for u in users]})

    @transaction.atomic
    def post(self, request):
        phone = normalize_phone(request.data.get("phone"))
        if not phone:
            return error("شماره‌ی موبایل درست نیست.")
        if User.objects.filter(phone=phone, role=User.Role.TEAM_ADMIN).exists():
            return error("این شماره قبلاً حسابِ تیم دارد.")
        caps = capabilities.clean(request.data.get("capabilities"))
        if not caps:
            return error("دست‌کم یک دسترسی را تیک بزنید.")
        password = str(request.data.get("password") or "")
        problem = check_password_rules(password)
        if problem:
            return error(problem)
        try:
            user = User.objects.create_user(
                phone, password=password, role=User.Role.TEAM_ADMIN, is_staff=True,
                first_name=str(request.data.get("first_name") or "").strip()[:60],
                last_name=str(request.data.get("last_name") or "").strip()[:60],
                phone_verified=False,
            )
        except IntegrityError:
            return error("این شماره قبلاً حسابِ تیم دارد.")
        StaffAccess.objects.create(user=user, title=str(request.data.get("title") or "").strip()[:60],
                                   capabilities=caps, created_by=request.user)
        audit.record(request, "staff_create", target=user, target_type="user",
                     target_label=full_name(user) or phone, details={"capabilities": caps})
        user.refresh_from_db()
        return Response(staff_row(user, timezone.now()), status=201)


def _staff(pk):
    return User.objects.select_related("staff_access").filter(pk=pk, is_staff=True).first()


class StaffDetailView(DashboardView):
    """PATCH {title, capabilities, isActive, firstName, lastName} · DELETE = برداشتنِ دسترسی"""

    capability = capabilities.SUPERUSER

    def patch(self, request, pk):
        user = _staff(pk)
        if user is None:
            return error("کارمند پیدا نشد.", 404)
        if user.is_superuser:
            return error("مدیرِ کل از این‌جا ویرایش نمی‌شود.", 403)
        access, _ = StaffAccess.objects.get_or_create(user=user, defaults={"created_by": request.user})
        changes = {}
        if "capabilities" in request.data:
            caps = capabilities.clean(request.data.get("capabilities"))
            if not caps:
                return error("دست‌کم یک دسترسی را تیک بزنید؛ برای بستنِ کامل، «برداشتنِ دسترسی» را بزنید.")
            if caps != capabilities.clean(access.capabilities):
                changes["capabilities"] = [capabilities.clean(access.capabilities), caps]
                access.capabilities = caps
        if "title" in request.data:
            access.title = str(request.data.get("title") or "").strip()[:60]
        access.save()
        for field in ("first_name", "last_name"):
            if field in request.data:
                setattr(user, field, str(request.data.get(field) or "").strip()[:60])
        if "is_active" in request.data:
            active = bool(request.data.get("is_active"))
            if active != user.is_active:
                changes["is_active"] = [user.is_active, active]
                user.is_active = active
        user.save()
        audit.record(request, "staff_update", target=user, target_type="user",
                     target_label=full_name(user) or user.phone, details=changes)
        return Response(staff_row(_staff(pk), timezone.now()))

    def delete(self, request, pk):
        user = _staff(pk)
        if user is None:
            return error("کارمند پیدا نشد.", 404)
        if user.is_superuser or user.pk == request.user.pk:
            return error("این حساب از این‌جا برداشته نمی‌شود.", 403)
        StaffAccess.objects.filter(user=user).delete()
        user.is_staff = False
        user.save(update_fields=["is_staff"])
        audit.record(request, "staff_remove", target=user, target_type="user",
                     target_label=full_name(user) or user.phone)
        return Response({"ok": True})


class StaffPasswordView(DashboardView):
    """POST {password} — رمزِ تازه؛ نشست‌های داشبوردِ آن کارمند خودبه‌خود بسته می‌شود."""

    capability = capabilities.SUPERUSER

    def post(self, request, pk):
        user = _staff(pk)
        if user is None:
            return error("کارمند پیدا نشد.", 404)
        if user.is_superuser and user.pk != request.user.pk:
            return error("رمزِ مدیرِ کلِ دیگر از این‌جا عوض نمی‌شود.", 403)
        password = str(request.data.get("password") or "")
        problem = check_password_rules(password, user)
        if problem:
            return error(problem)
        user.set_password(password)
        user.save(update_fields=["password"])
        audit.record(request, "staff_password", target=user, target_type="user",
                     target_label=full_name(user) or user.phone)
        return Response({"ok": True})
