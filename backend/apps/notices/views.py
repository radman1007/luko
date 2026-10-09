from django.utils import timezone
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.common.fa import fa_when

from .models import KidNotice


class IsStudent(BasePermission):
    message = "این بخش فقط برای حسابِ دانش‌آموز است."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == User.Role.STUDENT)


def notice_payload(notice: KidNotice, today) -> dict:
    return {
        "id": notice.id,
        "title": notice.title,
        "body": notice.body,
        "link": notice.link,
        "is_read": notice.is_read,
        "at": fa_when(timezone.localtime(notice.created_at), today),
    }


class KidNoticesView(APIView):
    """GET /notices — پیام‌های بچه (۳۰ تای آخر) و تعدادِ نخوانده."""

    permission_classes = [IsStudent]

    def get(self, request):
        today = timezone.localdate()
        rows = KidNotice.objects.filter(user=request.user)[:30]
        return Response({
            "items": [notice_payload(n, today) for n in rows],
            "unread": KidNotice.objects.filter(user=request.user, is_read=False).count(),
        })


class KidNoticesReadView(APIView):
    """POST /notices/read — همه خوانده شد."""

    permission_classes = [IsStudent]

    def post(self, request):
        KidNotice.objects.filter(user=request.user, is_read=False).update(is_read=True)
        return Response({"ok": True, "unread": 0})
