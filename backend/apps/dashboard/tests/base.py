import shutil
import tempfile
import time

from django.conf import settings
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.dashboard.models import StaffAccess
from apps.dashboard.security import SESSION_MARK, SESSION_SEEN

PNG = b"\x89PNG\r\n\x1a\n" + b"\0" * 64


def url(path: str) -> str:
    return f"/{settings.DASHBOARD_PATH}/api/{path}"


@override_settings(OTP_EXPOSE_DEV_CODE=True, SITE_URL="https://my.luko.ir")
class DashboardTestBase(TestCase):
    password = "Panel-Secret-2026"

    def setUp(self):
        cache.clear()
        self.media = tempfile.mkdtemp(prefix="luko-dash-")
        self.addCleanup(shutil.rmtree, self.media, ignore_errors=True)
        media = override_settings(MEDIA_ROOT=self.media)
        media.enable()
        self.addCleanup(media.disable)
        self.api = APIClient()
        self.admin = User.objects.create_superuser("09120000900", self.password, first_name="مدیر", last_name="کل")

    def make_staff(self, phone: str, caps: list[str], title: str = "کارمند") -> User:
        user = User.objects.create_user(phone, password=self.password, role=User.Role.TEAM_ADMIN, is_staff=True)
        StaffAccess.objects.create(user=user, title=title, capabilities=caps)
        return user

    def sign_in(self, user: User, client: APIClient | None = None) -> APIClient:
        """نشستِ داشبوردیِ کامل (بی‌پیامک) برای تست‌هایی که موضوعشان ورود نیست."""
        client = client or self.api
        client.force_login(user)
        session = client.session
        now = int(time.time())
        session[SESSION_MARK] = now
        session[SESSION_SEEN] = now
        session.save()
        return client

    def get(self, path, **params):
        return self.api.get(url(path), params)

    def post(self, path, data=None, **kw):
        return self.api.post(url(path), data or {}, format=kw.pop("format", "json"), **kw)

    def patch(self, path, data=None, **kw):
        return self.api.patch(url(path), data or {}, format=kw.pop("format", "json"), **kw)

    def delete(self, path):
        return self.api.delete(url(path))

    def data(self, response):
        return response.json()["data"]

    def message(self, response) -> str:
        return response.json()["error"]["message"]
