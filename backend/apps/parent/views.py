"""
APIهای پنل والدین. دسترسی فقط برای نقشِ parent و فقط به فرزندانِ خودش.
"""
from django.db import transaction
from django.db.models import Max
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from django.conf import settings

from apps.accounts.models import PasswordVault, User
from apps.accounts.otp import OTPRateLimited, request_otp, verify_otp
from apps.accounts.passwords import link_family, set_password
from apps.accounts.utils import normalize_phone
from apps.common.sms import SmsError

from .models import DailyAssignment, Notification, ParentChild
from .notifications import preferences, reset_sync_throttle, sync_notifications
from .serializers import (
    AddChildSerializer,
    AssignmentSerializer,
    ChildPasswordSerializer,
    ChildPhoneSerializer,
    ChildSerializer,
    CreateAssignmentSerializer,
    NotificationSerializer,
    PreferenceSerializer,
)
from .services import build_child_report
from .suggestions import suggestion_payload


class IsParent(BasePermission):
    message = "این بخش فقط برای حسابِ والدین است."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated
                    and request.user.role in {User.Role.PARENT, User.Role.TEAM_ADMIN})


def _link_or_404(request, child_id):
    return ParentChild.objects.filter(
        parent=request.user, child_id=child_id, is_active=True
    ).select_related("child").first()


class ChildrenView(APIView):
    """GET فهرست فرزندان · POST افزودن فرزند با شماره‌ی موبایل."""

    permission_classes = [IsParent]

    def get(self, request):
        links = (
            ParentChild.objects.filter(parent=request.user, is_active=True)
            .select_related("child")
            # آخرین بازیِ هر بچه در همین کوئری می‌آید تا سریالایزر کوئریِ جدا نزند
            .annotate(last_play=Max("child__game_completions__created_at"))
        )
        return Response(ChildSerializer(links, many=True).data)

    @transaction.atomic
    def post(self, request):
        serializer = AddChildSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        phone = normalize_phone(data["phone"])

        # همیشه حسابِ تازه می‌سازیم، حتی اگر شماره تکراری باشد: یک خانواده
        # می‌تواند چند بچه با یک شماره داشته باشد و رمز آن‌ها را از هم جدا
        # می‌کند. بچه‌ای که خودش ثبت‌نام کرده از راهِ `link_family` خودکار
        # به همین والد وصل شده و این‌جا دوباره ساخته نمی‌شود.
        child = User(
            phone=phone,
            role=User.Role.STUDENT,
            first_name=data.get("first_name", ""),
            last_name=data.get("last_name", ""),
            grade=data.get("grade", 1),
        )
        child.save()
        set_password(child, data["password"])

        link = ParentChild.objects.create(
            parent=request.user, child=child,
            grade=data.get("grade", 1), school=data.get("school", ""),
        )
        return Response(ChildSerializer(link).data, status=status.HTTP_201_CREATED)


class ChildDetailView(APIView):
    """DELETE — قطعِ دسترسیِ والد به فرزند (حسابِ بچه پاک نمی‌شود)."""

    permission_classes = [IsParent]

    def delete(self, request, child_id):
        link = _link_or_404(request, child_id)
        if link is None:
            return Response({"error": {"code": 404, "message": "فرزند پیدا نشد."}},
                            status=status.HTTP_404_NOT_FOUND)
        link.is_active = False
        link.save(update_fields=["is_active", "updated_at"])
        return Response({"ok": True})


class ChildReportView(APIView):
    """GET /parent/children/{id}/report — همان شکلی که پنل والدین می‌خواهد."""

    permission_classes = [IsParent]

    def get(self, request, child_id):
        link = _link_or_404(request, child_id)
        if link is None:
            return Response({"error": {"code": 404, "message": "فرزند پیدا نشد."}},
                            status=status.HTTP_404_NOT_FOUND)
        return Response(build_child_report(link.child))


class AssignmentsView(APIView):
    """
    «بازی روز»ی که والد برای فرزندش می‌گذارد.
    GET  — فهرست (پیش‌فرض: از امروز به بعد؛ با ?history=1 گذشته هم می‌آید)
    POST — ثبت/جایگزینی بازیِ یک روز
    """

    permission_classes = [IsParent]

    def _context(self, child):
        from apps.games.models import Book, Game, GameCompletion
        played = {
            (c.game_slug, timezone.localtime(c.created_at).date())
            for c in GameCompletion.objects.filter(user=child)
        }
        return {
            "games": {g.slug: g for g in Game.objects.all()},
            "books": {b.book_id: b for b in Book.objects.all()},
            "played": played,
        }

    def get(self, request, child_id):
        link = _link_or_404(request, child_id)
        if link is None:
            return Response({"error": {"code": 404, "message": "فرزند پیدا نشد."}},
                            status=status.HTTP_404_NOT_FOUND)
        rows = DailyAssignment.objects.filter(child=link.child)
        if request.query_params.get("history") != "1":
            rows = rows.filter(date__gte=timezone.localdate())
        return Response(AssignmentSerializer(rows, many=True,
                                             context=self._context(link.child)).data)

    def post(self, request, child_id):
        link = _link_or_404(request, child_id)
        if link is None:
            return Response({"error": {"code": 404, "message": "فرزند پیدا نشد."}},
                            status=status.HTTP_404_NOT_FOUND)
        serializer = CreateAssignmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        assignment, created = DailyAssignment.objects.update_or_create(
            child=link.child, date=data["date"],
            defaults={"game_slug": data["game_slug"], "note": data.get("note", ""),
                      "assigned_by": request.user},
        )
        return Response(
            AssignmentSerializer(assignment, context=self._context(link.child)).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class AssignmentDetailView(APIView):
    permission_classes = [IsParent]

    def delete(self, request, child_id, pk):
        link = _link_or_404(request, child_id)
        if link is None:
            return Response({"error": {"code": 404, "message": "فرزند پیدا نشد."}},
                            status=status.HTTP_404_NOT_FOUND)
        deleted, _ = DailyAssignment.objects.filter(pk=pk, child=link.child).delete()
        if not deleted:
            return Response({"error": {"code": 404, "message": "این برنامه پیدا نشد."}},
                            status=status.HTTP_404_NOT_FOUND)
        return Response({"ok": True})


class MyAssignmentView(APIView):
    """سمتِ بچه: بازی‌ای که امروز والدش برایش گذاشته (اگر گذاشته باشد)."""

    def get(self, request):
        assignment = DailyAssignment.objects.filter(
            child=request.user, date=timezone.localdate()
        ).first()
        if assignment is None:
            return Response({"assignment": None})
        from apps.games.models import Book, Game, GameCompletion
        context = {
            "games": {g.slug: g for g in Game.objects.all()},
            "books": {b.book_id: b for b in Book.objects.all()},
            "played": {(c.game_slug, timezone.localtime(c.created_at).date())
                       for c in GameCompletion.objects.filter(user=request.user)},
        }
        return Response({"assignment": AssignmentSerializer(assignment, context=context).data})


class PreferenceView(APIView):
    """GET/PATCH — تنظیم‌های حسابِ والد (سوییچ‌های تبِ تنظیمات)."""

    permission_classes = [IsParent]

    def get(self, request):
        return Response(PreferenceSerializer(preferences(request.user)).data)

    def patch(self, request):
        pref = preferences(request.user)
        serializer = PreferenceSerializer(pref, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        # سوییچِ تازه باید فوراً روی اعلان‌ها اثر کند، نه بعد از پایانِ throttle
        reset_sync_throttle(request.user)
        return Response(serializer.data)


class NotificationsView(APIView):
    """GET — اعلان‌ها (تازه‌ها همین‌جا از داده‌ی واقعی ساخته می‌شوند)."""

    permission_classes = [IsParent]

    def get(self, request):
        sync_notifications(request.user)
        rows = Notification.objects.filter(user=request.user).select_related("child")[:30]
        return Response({
            "items": NotificationSerializer(rows, many=True).data,
            "unread": Notification.objects.filter(user=request.user, is_read=False).count(),
        })


class NotificationsReadView(APIView):
    """POST — همه‌ی اعلان‌ها را خوانده‌شده علامت می‌زند."""

    permission_classes = [IsParent]

    def post(self, request):
        Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
        return Response({"ok": True, "unread": 0})


class SuggestionsView(APIView):
    """GET — پیشنهادِ بازی روز برای یک فرزند، بر اساسِ ضعیف‌ترین مبحثش."""

    permission_classes = [IsParent]

    def get(self, request, child_id):
        link = _link_or_404(request, child_id)
        if link is None:
            return Response({"error": {"code": 404, "message": "فرزند پیدا نشد."}},
                            status=status.HTTP_404_NOT_FOUND)
        return Response(suggestion_payload(link.child))


class ChildPasswordView(APIView):
    """
    GET رمزِ فرزند · POST تغییرش.

    والد باید بتواند رمزِ بچه را ببیند: بچه‌ی کلاس‌اولی رمزش را فراموش
    می‌کند و کسی جز والد نمی‌تواند برایش بازیابی کند. رمز رمزنگاری‌شده
    نگه داشته می‌شود و فقط از همین مسیرِ احرازشده برمی‌گردد.
    """

    permission_classes = [IsParent]

    def get(self, request, child_id):
        link = _link_or_404(request, child_id)
        if link is None:
            return Response({"error": {"code": 404, "message": "فرزند پیدا نشد."}},
                            status=status.HTTP_404_NOT_FOUND)
        vault = PasswordVault.objects.filter(user=link.child).first()
        shown = vault.reveal() if vault and vault.sealed else None
        return Response({"password": shown or "", "hasPassword": bool(shown)})

    def post(self, request, child_id):
        link = _link_or_404(request, child_id)
        if link is None:
            return Response({"error": {"code": 404, "message": "فرزند پیدا نشد."}},
                            status=status.HTTP_404_NOT_FOUND)
        serializer = ChildPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        set_password(link.child, serializer.validated_data["password"])
        return Response({"ok": True})


class ChildPhoneStartView(APIView):
    """
    POST — گامِ ۱ تغییرِ شماره: کد به **شماره‌ی فعلی** و به **شماره‌ی تازه**.

    هر دو طرف باید تأیید شوند: کدِ شماره‌ی فعلی ثابت می‌کند این شماره واقعاً
    دستِ خانواده است، و کدِ شماره‌ی تازه ثابت می‌کند شماره‌ی مقصد اشتباه
    تایپ نشده — وگرنه حسابِ بچه روی شماره‌ای می‌رفت که کسی به آن دسترسی ندارد.
    """

    permission_classes = [IsParent]

    def post(self, request, child_id):
        link = _link_or_404(request, child_id)
        if link is None:
            return Response({"error": {"code": 404, "message": "فرزند پیدا نشد."}},
                            status=status.HTTP_404_NOT_FOUND)

        new_phone = normalize_phone(request.data.get("phone"))
        if new_phone is None:
            return Response({"error": {"code": 400, "message": "شماره‌ی موبایل معتبر نیست."}},
                            status=status.HTTP_400_BAD_REQUEST)
        if new_phone == link.child.phone:
            return Response({"error": {"code": 400, "message": "این همان شماره‌ی فعلی است."}},
                            status=status.HTTP_400_BAD_REQUEST)

        try:
            current = request_otp(link.child.phone)
            fresh = request_otp(new_phone)
        except OTPRateLimited as exc:
            return Response(
                {"error": {"code": 429, "message": "کمی صبر کن و دوباره بزن.",
                           "retryAfter": exc.args[0] if exc.args else 60}},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
        except SmsError as exc:
            return Response({"error": {"code": 502, "message": exc.message}},
                            status=status.HTTP_502_BAD_GATEWAY)

        out = {"currentPhone": link.child.phone, "newPhone": new_phone,
               "codeLength": fresh.get("length"), "resendIn": fresh.get("resend_in")}
        if settings.DEBUG:
            out["devCurrentCode"] = current.get("code")
            out["devNewCode"] = fresh.get("code")
        return Response(out)


class ChildPhoneConfirmView(APIView):
    """POST — گامِ ۲: هر دو کد درست باشند، شماره عوض می‌شود."""

    permission_classes = [IsParent]

    @transaction.atomic
    def post(self, request, child_id):
        link = _link_or_404(request, child_id)
        if link is None:
            return Response({"error": {"code": 404, "message": "فرزند پیدا نشد."}},
                            status=status.HTTP_404_NOT_FOUND)

        serializer = ChildPhoneSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        old_phone = link.child.phone
        if not verify_otp(old_phone, data["current_code"]):
            return Response({"error": {"code": 400, "message": "کدِ شماره‌ی فعلی درست نیست."}},
                            status=status.HTTP_400_BAD_REQUEST)
        if not verify_otp(data["phone"], data["new_code"]):
            return Response({"error": {"code": 400, "message": "کدِ شماره‌ی تازه درست نیست."}},
                            status=status.HTTP_400_BAD_REQUEST)

        child = link.child
        child.phone = data["phone"]
        # شماره عوض شد، پس تأییدِ قبلی دیگر معنایی ندارد
        child.phone_verified = True
        child.phone_verified_at = timezone.now()
        child.save(update_fields=["phone", "phone_verified", "phone_verified_at"])

        # شماره‌ی تازه ممکن است والدِ دیگری داشته باشد؛ خانواده دوباره بسته شود
        link_family(child)
        return Response({"ok": True, "phone": child.phone})
