"""ماتریسِ دسترسی: هر بخش فقط با تیکِ خودش؛ تعریفِ کارمند فقط برای مدیرِ کل."""
from rest_framework.test import APIClient

from .base import DashboardTestBase, url

#: (متد، مسیر، دسترسیِ لازم)
ENDPOINTS = [
    ("get", "overview", "stats"),
    ("get", "analytics", "stats"),
    ("get", "online", "stats"),
    ("get", "users", "users_view"),
    ("get", "users/1", "users_view"),
    ("patch", "users/1", "users_edit"),
    ("post", "users/1/logout-all", "users_edit"),
    ("get", "payments", "payments"),
    ("post", "payments/gift", "gifts"),
    ("post", "payments/1/revoke", "gifts"),
    ("get", "tickets", "tickets"),
    ("get", "tickets/1", "tickets"),
    ("post", "tickets/1/reply", "tickets"),
    ("post", "tickets/1/status", "tickets"),
    ("get", "podcasts", "podcasts"),
    ("post", "podcasts", "podcasts"),
    ("patch", "podcasts/1", "podcasts"),
    ("delete", "podcasts/1", "podcasts"),
    ("get", "blog", "blog"),
    ("post", "blog", "blog"),
    ("get", "blog/1", "blog"),
    ("post", "blog/images", "blog"),
    ("post", "blog/preview", "blog"),
    ("get", "notices", "notify"),
    ("post", "notices/preview", "notify"),
    ("post", "notices/send", "notify"),
    ("get", "audit", "audit"),
    ("get", "staff", "superuser"),
    ("post", "staff", "superuser"),
    ("patch", "staff/1", "superuser"),
    ("delete", "staff/1", "superuser"),
    ("post", "staff/1/password", "superuser"),
]


class PermissionMatrixTests(DashboardTestBase):
    def setUp(self):
        super().setUp()
        from apps.accounts.models import User

        self.kid = User.objects.create_user("09120005555", role="student")
        self.target_staff = self.make_staff("09120005556", ["stats"])

    def call(self, client, method, path):
        path = path.replace("users/1", f"users/{self.kid.pk}").replace("staff/1", f"staff/{self.target_staff.pk}")
        fn = getattr(client, method)
        if method in ("post", "patch"):
            return fn(url(path), {}, format="json")
        return fn(url(path))

    def test_everything_needs_login(self):
        anon = APIClient()
        for method, path, _ in ENDPOINTS + [("get", "me", None), ("get", "meta", None), ("post", "auth/logout", None)]:
            self.assertEqual(self.call(anon, method, path).status_code, 401, f"{method} {path}")

    def test_each_capability_opens_only_its_own_section(self):
        caps = sorted({cap for *_, cap in ENDPOINTS if cap != "superuser"})
        for i, cap in enumerate(caps):
            staff = self.make_staff(f"0912000{1000 + i}", [cap], title=cap)
            client = self.sign_in(staff, APIClient())
            for method, path, need in ENDPOINTS:
                status = self.call(client, method, path).status_code
                if need == cap:
                    self.assertNotIn(status, (401, 403), f"{cap}: {method} {path} -> {status}")
                else:
                    self.assertEqual(status, 403, f"{cap}: {method} {path} -> {status}")
            # me و meta برای همه
            self.assertEqual(client.get(url("me")).status_code, 200)
            self.assertEqual(client.get(url("meta")).status_code, 200)

    def test_superuser_opens_everything(self):
        self.sign_in(self.admin)
        for method, path, _ in ENDPOINTS:
            status = self.call(self.api, method, path).status_code
            self.assertNotIn(status, (401, 403), f"{method} {path} -> {status}")
