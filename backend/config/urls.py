"""مسیرهای ریشه. همه‌ی APIها زیر /api/v1 (منطبق با VITE_API_URL فرانت)."""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path

from apps.parent.views import MyAssignmentView as ParentAssignmentForChild


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
    path("", include("apps.sync.urls")),
    path("parent/", include("apps.parent.urls")),
    path("billing/", include("apps.billing.urls")),
    path("", include("apps.activity.urls")),
    path("", include("apps.notices.urls")),
    path("", include("apps.blog.urls")),
    path("my/assignment", ParentAssignmentForChild.as_view(), name="my-assignment"),
]

urlpatterns = [
    path(f"{settings.ADMIN_URL}/", admin.site.urls),
    path("healthz", health_check),
    path("api/v1/", include((api_v1, "api"), namespace="v1")),
]


def dashboard_patterns():
    """داشبورد فقط وقتی سوار می‌شود که نشانیِ بلندش تنظیم شده باشد (DASHBOARD_ENABLED)."""
    if not settings.DASHBOARD_ENABLED:
        return []
    return [path(f"{settings.DASHBOARD_PATH}/api/", include("apps.dashboard.urls"))]


urlpatterns[1:1] = dashboard_patterns()

# در توسعه جنگو خودش فایل‌های بارگذاری‌شده را سرو می‌کند؛ روی سرور nginx (/media/)
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
