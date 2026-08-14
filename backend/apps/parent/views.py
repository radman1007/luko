"""
APIهای پنل والدین. دسترسی فقط برای نقشِ parent و فقط به فرزندانِ خودش.
"""
from django.db import transaction
from rest_framework import status
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.accounts.utils import normalize_phone

from .models import ParentChild
from .serializers import AddChildSerializer, ChildSerializer
from .services import build_child_report


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
        )
        return Response(ChildSerializer(links, many=True).data)

    @transaction.atomic
    def post(self, request):
        serializer = AddChildSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        phone = normalize_phone(data["phone"])

        child, _ = User.objects.get_or_create(
            phone=phone,
            defaults={
                "role": User.Role.STUDENT,
                "first_name": data.get("first_name", ""),
                "last_name": data.get("last_name", ""),
            },
        )
        if child == request.user:
            return Response(
                {"error": {"code": 400, "message": "نمی‌توانید خودتان را به‌عنوان فرزند اضافه کنید."}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if child.role != User.Role.STUDENT:
            return Response(
                {"error": {"code": 400, "message": "این شماره حسابِ دانش‌آموز نیست."}},
                status=status.HTTP_400_BAD_REQUEST,
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
