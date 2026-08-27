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

from apps.accounts.models import User
from apps.accounts.utils import normalize_phone

from .models import DailyAssignment, Notification, ParentChild
from .notifications import preferences, reset_sync_throttle, sync_notifications
from .serializers import (
    AddChildSerializer,
    AssignmentSerializer,
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

        # نقش داخلِ جستجوست: اگر والد شماره‌ی خودش را بزند — که رایج است،
        # چون بچه با گوشیِ پدر/مادر ثبت‌نام کرده — حسابِ دانش‌آموزِ همان
        # شماره پیدا (یا ساخته) می‌شود، نه حسابِ والدِ خودش.
        child, _ = User.objects.get_or_create(
            phone=phone,
            role=User.Role.STUDENT,
            defaults={
                "first_name": data.get("first_name", ""),
                "last_name": data.get("last_name", ""),
            },
        )

        link, created = ParentChild.objects.get_or_create(
            parent=request.user, child=child,
            defaults={"grade": data.get("grade", 1), "school": data.get("school", "")},
        )
        if not created and not link.is_active:
            link.is_active = True
            link.save(update_fields=["is_active", "updated_at"])
        return Response(ChildSerializer(link).data,
                        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


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
