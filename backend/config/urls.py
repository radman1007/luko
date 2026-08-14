"""مسیرهای ریشه. همه‌ی APIها زیر /api/v1 (منطبق با VITE_API_URL فرانت)."""
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path


def health_check(_request):
    return JsonResponse({"data": {"status": "ok", "service": "luko-backend"}})


api_v1 = [
    path("auth/", include("apps.accounts.urls_auth")),
    path("", include("apps.accounts.urls")),
    path("", include("apps.health.urls")),
    path("club/", include("apps.club.urls")),
    path("garden/", include("apps.garden.urls")),
    path("", include("apps.games.urls")),
    path("", include("apps.content.urls")),
    path("", include("apps.support.urls")),
    path("parent/", include("apps.parent.urls")),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    path("healthz", health_check),
    path("api/v1/", include((api_v1, "api"), namespace="v1")),
]
