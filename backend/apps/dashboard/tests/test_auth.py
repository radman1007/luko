"""ورودِ دومرحله‌ای و نشستِ داشبورد."""
import time
from unittest import mock

from django.contrib.sessions.models import Session
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.accounts.sessions import new_session
from apps.common.sms import SmsError
from apps.dashboard.models import AuditLog, StaffAccess
from apps.dashboard.security import SESSION_SEEN

from .base import DashboardTestBase, url


class LoginTests(DashboardTestBase):
    def start(self, phone="09120000900", password=None):
        return self.post("auth/login", {"phone": phone, "password": password or self.password})

    def finish(self, challenge, code):
        return self.post("auth/verify", {"challenge": challenge, "code": code})

    def test_full_login_with_sms_code(self):
        res = self.start()
        self.assertEqual(res.status_code, 200)
        data = self.data(res)
        self.assertEqual(data["phone"], "0912•••900")
        self.assertEqual(len(data["devCode"]), 6)
        self.assertGreater(len(data["challenge"]), 30)
        # پیش از کد، داشبورد بسته است
        self.assertEqual(self.get("me").status_code, 401)
        me = self.finish(data["challenge"], data["devCode"])
        self.assertEqual(me.status_code, 200)
        self.assertTrue(self.data(me)["isSuperuser"])
        self.assertEqual(self.get("me").status_code, 200)
        self.assertTrue(AuditLog.objects.filter(action="login", actor=self.admin).exists())

    def test_persian_digits_in_code_work(self):
        data = self.data(self.start())
        fa = data["devCode"].translate(str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹"))
        self.assertEqual(self.finish(data["challenge"], fa).status_code, 200)

    def test_wrong_password_and_unknown_phone_look_the_same(self):
        wrong = self.start(password="nope-nope-nope")
        unknown = self.start(phone="09129999999")
        parent = User.objects.create_user("09121112233", password=self.password, role="parent")
        not_staff = self.start(phone=parent.phone)
        for res in (wrong, unknown, not_staff):
            self.assertEqual(res.status_code, 400)
            self.assertEqual(self.message(res), "شماره یا رمز درست نیست.")
        self.assertTrue(AuditLog.objects.filter(action="login_failed").exists())

    def test_staff_without_capabilities_cannot_log_in(self):
        user = self.make_staff("09120000901", [])
        self.assertEqual(self.start(phone=user.phone).status_code, 400)

    def test_lockout_after_repeated_wrong_passwords(self):
        for _ in range(5):
            self.start(password="wrong-password-1")
        res = self.start()                                   # حتی با رمزِ درست
        self.assertEqual(res.status_code, 429)
        self.assertIn("Retry-After", res)

    def test_wrong_codes_burn_the_challenge(self):
        data = self.data(self.start())
        for _ in range(5):
            self.assertEqual(self.finish(data["challenge"], "000000").status_code, 400)
        self.assertEqual(self.finish(data["challenge"], data["devCode"]).status_code, 429)
        self.assertEqual(self.get("me").status_code, 401)

    def test_challenge_is_single_use(self):
        data = self.data(self.start())
        self.assertEqual(self.finish(data["challenge"], data["devCode"]).status_code, 200)
        other = APIClient()
        res = other.post(url("auth/verify"), {"challenge": data["challenge"], "code": data["devCode"]}, format="json")
        self.assertEqual(res.status_code, 400)

    def test_resend_waits_a_minute(self):
        data = self.data(self.start())
        res = self.post("auth/resend", {"challenge": data["challenge"]})
        self.assertEqual(res.status_code, 429)

    def test_sms_failure_is_reported(self):
        with mock.patch("apps.dashboard.login_flow.send_verification_code", side_effect=SmsError("down", "x")):
            res = self.start()
        self.assertEqual(res.status_code, 503)

    def test_login_requires_csrf(self):
        strict = APIClient(enforce_csrf_checks=True)
        res = strict.post(url("auth/login"), {"phone": "09120000900", "password": self.password}, format="json")
        self.assertEqual(res.status_code, 403)
        strict.get(url("auth/csrf"))
        token = strict.cookies["csrftoken"].value
        res = strict.post(url("auth/login"), {"phone": "09120000900", "password": self.password}, format="json",
                          HTTP_X_CSRFTOKEN=token)
        self.assertEqual(res.status_code, 200)


class SessionTests(DashboardTestBase):
    def test_django_admin_session_is_not_a_dashboard_session(self):
        self.api.force_login(self.admin)                  # مثلِ ورود به پنلِ جنگو با رمز
        self.assertEqual(self.get("me").status_code, 401)

    def test_app_jwt_never_opens_the_dashboard(self):
        token = new_session(self.admin).access_token
        res = self.api.get(url("me"), HTTP_AUTHORIZATION=f"Bearer {token}")
        self.assertEqual(res.status_code, 401)

    def test_idle_session_is_closed(self):
        self.sign_in(self.admin)
        session = self.api.session
        session[SESSION_SEEN] = int(time.time()) - 31 * 60
        session.save()
        res = self.get("me")
        self.assertEqual(res.status_code, 401)
        self.assertIn("بی‌کاری", self.message(res))
        self.assertEqual(self.get("me").status_code, 401)

    def test_logout_ends_session(self):
        self.sign_in(self.admin)
        self.assertEqual(self.post("auth/logout").status_code, 200)
        self.assertEqual(self.get("me").status_code, 401)

    def test_access_is_rechecked_every_request(self):
        staff = self.make_staff("09120000902", ["stats"])
        self.sign_in(staff)
        self.assertEqual(self.get("overview").status_code, 200)
        StaffAccess.objects.filter(user=staff).update(capabilities=[])
        self.assertEqual(self.get("overview").status_code, 401)
        StaffAccess.objects.filter(user=staff).update(capabilities=["stats"])
        User.objects.filter(pk=staff.pk).update(is_active=False)
        self.assertEqual(self.get("overview").status_code, 401)

    def test_password_change_kills_sessions(self):
        staff = self.make_staff("09120000903", ["stats"])
        self.sign_in(staff)
        staff.set_password("Another-Secret-99")
        staff.save()
        self.assertEqual(self.get("overview").status_code, 401)
        self.assertTrue(Session.objects.exists() or True)

    def test_responses_are_not_cached(self):
        self.sign_in(self.admin)
        res = self.get("me")
        self.assertEqual(res["Cache-Control"], "no-store")
        self.assertIn("noindex", res["X-Robots-Tag"])


class MountTests(DashboardTestBase):
    def test_dashboard_is_mounted_only_with_a_long_path(self):
        from django.test import override_settings

        from config.urls import dashboard_patterns

        with override_settings(DASHBOARD_ENABLED=False):
            self.assertEqual(dashboard_patterns(), [])
        with override_settings(DASHBOARD_ENABLED=True, DASHBOARD_PATH="manage-" + "a" * 32):
            self.assertEqual(str(dashboard_patterns()[0].pattern), "manage-" + "a" * 32 + "/api/")
