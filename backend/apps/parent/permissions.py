from rest_framework.permissions import BasePermission

from apps.accounts.models import User


class IsParent(BasePermission):
    message = "این بخش فقط برای حسابِ والدین است."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated
                    and request.user.role in {User.Role.PARENT, User.Role.TEAM_ADMIN})
