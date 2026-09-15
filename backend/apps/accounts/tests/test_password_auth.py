"""
ورود و ثبت‌نام با کدِ پیامکی؛ رمز فقط راهِ جایگزین.

قرارِ محصول:
  - بارِ اول: شماره → کد (تأییدِ شماره) → رمز → مشخصات.
  - بعد از آن: ورود با کد. ورود با رمز برای وقتی است که کد نمی‌رسد.
  - ثبت‌نامِ بی‌تأیید (`/auth/register`) و پرس‌وجوی حساب (`/auth/start`) بسته‌اند.
"""
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import PasswordVault, User
from apps.accounts.otp import request_otp
from apps.accounts.passwords import set_password
from apps.accounts.vault import open_sealed, seal


def _wrong(code: str) -> str:
    return "11111" if code != "11111" else "22222"


@override_settings(SMS_BACKEND="console", PASSWORD_VAULT_KEY="test-vault-key")
class OtpFirstSignupTests(TestCase):
    def setUp(self):
        cache.clear()
        self.api = APIClient()

    def _code_login(self, phone, role=None):
        body = {"phone": phone, "code": request_otp(phone)["code"]}
        if role:
            body["role"] = role
        return self.api.post("/api/v1/auth/verify-otp", body, format="json")

    def _signed_in(self, res):
        token = res.json()["data"]["accessToken"]
        self.api.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    def _finish_signup(self, phone, role=None, password="luko1234", name="سارا", grade=None):
        self._signed_in(self._code_login(phone, role))
        res = self.api.post("/api/v1/auth/set-password", {"password": password}, format="json")
        self.assertEqual(res.status_code, 200)
        body = {"firstName": name}
        if grade is not None:
            body["grade"] = grade
        self.assertEqual(self.api.patch("/api/v1/auth/me", body, format="json").status_code, 200)
        self.api.credentials()

    def test_a_new_number_starts_with_the_code(self):
        res = self._code_login("09121130001")
        self.assertEqual(res.status_code, 201)
        data = res.json()["data"]
        self.assertTrue(data["isNew"])
        self.assertTrue(data["needsPassword"])
        self.assertTrue(data["needsProfile"])
        # کدِ درست همان تأییدِ شماره است
        self.assertTrue(data["user"]["phoneVerified"])

    def test_a_wrong_code_creates_nothing(self):
        code = request_otp("09121130002")["code"]
        res = self.api.post("/api/v1/auth/verify-otp",
                            {"phone": "09121130002", "code": _wrong(code)}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertFalse(User.objects.filter(phone="09121130002").exists())

    def test_after_signup_the_code_logs_straight_in(self):
        phone = "09121130003"
        self._finish_signup(phone, grade=2)
        res = self._code_login(phone)
        self.assertEqual(res.status_code, 200)
        data = res.json()["data"]
        self.assertFalse(data["isNew"])
        self.assertFalse(data["needsPassword"])
        self.assertFalse(data["needsProfile"])
        self.assertEqual(data["user"]["firstName"], "سارا")
        self.assertEqual(data["user"]["grade"], 2)
        self.assertEqual(User.objects.filter(phone=phone).count(), 1)

    def test_the_password_is_the_fallback(self):
        phone = "09121130004"
        self._finish_signup(phone)
        res = self.api.post("/api/v1/auth/login", {"phone": phone, "password": "luko1234"},
                            format="json")
        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.json()["data"]["needsPassword"])
        self.assertFalse(res.json()["data"]["needsProfile"])

    def test_an_abandoned_signup_resumes_at_the_password(self):
        phone = "09121130005"
        first_id = self._code_login(phone).json()["data"]["user"]["id"]
        again = self._code_login(phone).json()["data"]
        self.assertEqual(again["user"]["id"], first_id)
        self.assertFalse(again["isNew"])
        self.assertTrue(again["needsPassword"])

    def test_a_password_without_a_name_still_asks_for_the_profile(self):
        phone = "09121130006"
        self._signed_in(self._code_login(phone))
        self.api.post("/api/v1/auth/set-password", {"password": "luko1234"}, format="json")
        self.api.credentials()
        data = self._code_login(phone).json()["data"]
        self.assertFalse(data["needsPassword"])
        self.assertTrue(data["needsProfile"])
        # ورود با رمز هم همین را می‌گوید؛ بی‌اسم به شهر نمی‌رود
        res = self.api.post("/api/v1/auth/login", {"phone": phone, "password": "luko1234"},
                            format="json")
        self.assertTrue(res.json()["data"]["needsProfile"])

    def test_parents_follow_the_same_steps(self):
        phone = "09121130007"
        first = self._code_login(phone, role="parent")
        self.assertEqual(first.status_code, 201)
        self.assertEqual(first.json()["data"]["user"]["role"], "parent")
        self.assertTrue(first.json()["data"]["needsPassword"])
        self._signed_in(first)
        self.api.post("/api/v1/auth/set-password", {"password": "raz-madar1"}, format="json")
        self.api.patch("/api/v1/auth/me", {"firstName": "مادر"}, format="json")
        self.api.credentials()

        again = self._code_login(phone, role="parent").json()["data"]
        self.assertEqual(again["user"]["role"], "parent")
        self.assertFalse(again["needsPassword"])
        self.assertFalse(again["needsProfile"])
        res = self.api.post("/api/v1/auth/login",
                            {"phone": phone, "password": "raz-madar1", "role": "parent"},
                            format="json")
        self.assertEqual(res.status_code, 200)

    def test_a_code_login_verifies_an_old_unverified_account(self):
        phone = "09121130008"
        old = User.objects.create(phone=phone, role=User.Role.STUDENT, first_name="قدیمی")
        set_password(old, "luko1234")
        self.assertFalse(old.phone_verified)
        self._code_login(phone)
        old.refresh_from_db()
        self.assertTrue(old.phone_verified)
        self.assertIsNotNone(old.phone_verified_at)

    def test_signup_without_a_code_is_closed(self):
        for path in ("/api/v1/auth/register", "/api/v1/auth/start"):
            res = self.api.post(path, {"phone": "09121130009", "firstName": "x",
                                       "role": "student"}, format="json")
            self.assertEqual(res.status_code, 410, path)
        self.assertFalse(User.objects.filter(phone="09121130009").exists())

    def test_every_way_in_still_lasts_two_weeks(self):
        """ماندگاریِ دو هفته: هر راهِ ورود توکنِ تمدیدِ ۱۴روزه می‌دهد."""
        phone = "09121130010"
        self._finish_signup(phone)
        by_code = self._code_login(phone)
        by_password = self.api.post("/api/v1/auth/login",
                                    {"phone": phone, "password": "luko1234"}, format="json")
        for res in (by_code, by_password):
            refresh = RefreshToken(res.json()["data"]["refreshToken"])
            self.assertAlmostEqual((refresh["exp"] - refresh["iat"]) / 86400, 14, delta=0.01)


@override_settings(SMS_BACKEND="console", PASSWORD_VAULT_KEY="test-vault-key")
class PasswordRulesTests(TestCase):
    def setUp(self):
        cache.clear()
        self.api = APIClient()

    def test_wrong_password_is_refused_with_a_neutral_message(self):
        phone = "09121130011"
        user, _ = User.objects.get_or_create(phone=phone, role=User.Role.STUDENT)
        set_password(user, "luko1234")
        res = self.api.post("/api/v1/auth/login", {"phone": phone, "password": "غلط"},
                            format="json")
        self.assertEqual(res.status_code, 400)
        # همان پیامِ «شماره یا رمز» تا معلوم نشود کدام شماره حساب دارد
        unknown = self.api.post("/api/v1/auth/login",
                                {"phone": "09129999999", "password": "x"}, format="json")
        self.assertEqual(res.json()["error"]["message"], unknown.json()["error"]["message"])

    def test_short_password_is_refused(self):
        user = User.objects.create(phone="09121130012", role=User.Role.STUDENT)
        self.api.force_authenticate(user)
        self.assertEqual(
            self.api.post("/api/v1/auth/set-password", {"password": "123"},
                          format="json").status_code, 400)

    def test_an_account_without_a_password_cannot_use_the_fallback(self):
        phone = "09121130013"
        User.objects.create(phone=phone, role=User.Role.STUDENT, first_name="بی‌رمز")
        for attempt in ("", "abc123"):
            res = self.api.post("/api/v1/auth/login", {"phone": phone, "password": attempt},
                                format="json")
            self.assertEqual(res.status_code, 400, attempt)

    def test_setting_a_password_needs_a_signed_in_user(self):
        self.assertEqual(
            self.api.post("/api/v1/auth/set-password", {"password": "luko1234"},
                          format="json").status_code, 401)

    def test_a_forgotten_password_is_replaced_after_a_code_login(self):
        phone = "09121130014"
        user, _ = User.objects.get_or_create(phone=phone, role=User.Role.PARENT)
        set_password(user, "قدیمی۱۲۳")

        code = request_otp(phone)["code"]
        signed = self.api.post("/api/v1/auth/verify-otp",
                               {"phone": phone, "code": code, "role": "parent"}, format="json")
        self.assertEqual(signed.status_code, 200)
        token = signed.json()["data"]["accessToken"]

        self.api.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        self.api.post("/api/v1/auth/set-password", {"password": "تازه۴۵۶"}, format="json")
        self.api.credentials()

        body = {"phone": phone, "role": "parent"}
        self.assertEqual(self.api.post("/api/v1/auth/login", {**body, "password": "تازه۴۵۶"},
                                       format="json").status_code, 200)
        self.assertEqual(self.api.post("/api/v1/auth/login", {**body, "password": "قدیمی۱۲۳"},
                                       format="json").status_code, 400)

    def test_a_password_only_account_can_still_verify_its_phone(self):
        user = User.objects.create(phone="09121130015", role=User.Role.STUDENT)
        set_password(user, "luko1234")
        code = request_otp(user.phone)["code"]
        self.api.force_authenticate(user)
        res = self.api.post("/api/v1/auth/verify-phone", {"code": code}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json()["data"]["phoneVerified"])
        user.refresh_from_db()
        self.assertIsNotNone(user.phone_verified_at)

    def test_wrong_verification_code_leaves_phone_unverified(self):
        user = User.objects.create(phone="09121130016", role=User.Role.STUDENT)
        code = request_otp(user.phone)["code"]
        self.api.force_authenticate(user)
        res = self.api.post("/api/v1/auth/verify-phone", {"code": _wrong(code)}, format="json")
        self.assertEqual(res.status_code, 400)
        user.refresh_from_db()
        self.assertFalse(user.phone_verified)


@override_settings(PASSWORD_VAULT_KEY="test-vault-key")
class PasswordVaultTests(TestCase):
    """رمز باید برای پشتیبانی خوانا شود، ولی نه از روی دیتابیسِ خام."""

    def test_round_trip(self):
        sealed = seal("رمزِ من ۱۲۳")
        self.assertNotIn("رمزِ من", sealed)
        self.assertEqual(open_sealed(sealed), "رمزِ من ۱۲۳")

    def test_tampered_data_is_rejected(self):
        sealed = seal("abc123")
        broken = sealed[:-4] + "AAAA"
        self.assertIsNone(open_sealed(broken))

    def test_wrong_key_cannot_open_it(self):
        sealed = seal("abc123")
        with override_settings(PASSWORD_VAULT_KEY="یک کلیدِ دیگر"):
            self.assertIsNone(open_sealed(sealed))

    def test_without_a_key_nothing_is_stored(self):
        with override_settings(PASSWORD_VAULT_KEY=""):
            self.assertEqual(seal("abc123"), "")

    def test_set_password_fills_the_vault(self):
        user = User.objects.create(phone="09121131001", role=User.Role.STUDENT)
        set_password(user, "luko9876")
        vault = PasswordVault.objects.get(user=user)
        self.assertEqual(vault.reveal(), "luko9876")
        # هَشِ احراز هویت هم سرِ جایش است
        user.refresh_from_db()
        self.assertTrue(user.check_password("luko9876"))
        self.assertNotIn("luko9876", user.password)

    def test_changing_the_password_updates_the_vault(self):
        user = User.objects.create(phone="09121131002", role=User.Role.STUDENT)
        set_password(user, "اولی۱۲۳")
        set_password(user, "دومی۴۵۶")
        self.assertEqual(PasswordVault.objects.get(user=user).reveal(), "دومی۴۵۶")
