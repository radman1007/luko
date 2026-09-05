"""ثبت‌نام و ورود با شماره و رمز، بدونِ تأییدِ اجباریِ شماره."""
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.accounts.models import PasswordVault, User
from apps.accounts.otp import request_otp
from apps.accounts.passwords import set_password
from apps.accounts.vault import open_sealed, seal


@override_settings(SMS_BACKEND="console", PASSWORD_VAULT_KEY="test-vault-key")
class PasswordAuthTests(TestCase):
    def setUp(self):
        cache.clear()
        self.api = APIClient()

    def _register(self, phone="09121130001", role=None, name="رادمان"):
        body = {"phone": phone, "firstName": name}
        if role:
            body["role"] = role
        return self.api.post("/api/v1/auth/register", body, format="json")

    # ── ثبت‌نام ──────────────────────────────────────────────
    def test_register_needs_only_a_phone(self):
        res = self._register()
        self.assertEqual(res.status_code, 201)
        data = res.json()["data"]
        self.assertTrue(data["accessToken"])
        self.assertFalse(data["user"]["phoneVerified"])

    def test_start_says_whether_the_account_has_a_password(self):
        phone = "09121130002"
        first = self.api.post("/api/v1/auth/start", {"phone": phone}, format="json")
        self.assertFalse(first.json()["data"]["exists"])

        self._register(phone)
        # هنوز رمز نگذاشته، پس باید مثل حسابِ تازه رفتار شود
        mid = self.api.post("/api/v1/auth/start", {"phone": phone}, format="json")
        self.assertFalse(mid.json()["data"]["exists"])

        user = User.objects.get(phone=phone, role=User.Role.STUDENT)
        set_password(user, "پسورد۱۲۳")
        after = self.api.post("/api/v1/auth/start", {"phone": phone}, format="json")
        self.assertTrue(after.json()["data"]["exists"])

    def test_registering_twice_after_a_password_is_refused(self):
        phone = "09121130003"
        token = self._register(phone).json()["data"]["accessToken"]
        self.api.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        self.api.post("/api/v1/auth/set-password", {"password": "abc123"}, format="json")
        self.api.credentials()
        again = self._register(phone)
        self.assertEqual(again.status_code, 409)

    def test_one_phone_can_hold_a_child_and_a_parent_account(self):
        phone = "09121130004"
        kid = self._register(phone).json()["data"]["user"]
        parent = self._register(phone, role="parent").json()["data"]["user"]
        self.assertNotEqual(kid["id"], parent["id"])
        self.assertEqual(parent["role"], "parent")

    # ── رمز ──────────────────────────────────────────────────
    def test_set_password_then_login(self):
        phone = "09121130005"
        token = self._register(phone).json()["data"]["accessToken"]
        self.api.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        self.assertEqual(
            self.api.post("/api/v1/auth/set-password", {"password": "luko1234"},
                          format="json").status_code, 200)
        self.api.credentials()
        res = self.api.post("/api/v1/auth/login", {"phone": phone, "password": "luko1234"},
                            format="json")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json()["data"]["accessToken"])

    def test_wrong_password_is_refused_with_a_neutral_message(self):
        phone = "09121130006"
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
        token = self._register("09121130007").json()["data"]["accessToken"]
        self.api.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        self.assertEqual(
            self.api.post("/api/v1/auth/set-password", {"password": "123"},
                          format="json").status_code, 400)

    def test_account_without_password_cannot_log_in(self):
        phone = "09121130008"
        self._register(phone)
        res = self.api.post("/api/v1/auth/login", {"phone": phone, "password": ""},
                            format="json")
        self.assertEqual(res.status_code, 400)

    def test_login_needs_authentication_for_set_password(self):
        self.api.credentials()
        self.assertEqual(
            self.api.post("/api/v1/auth/set-password", {"password": "luko1234"},
                          format="json").status_code, 401)

    # ── فراموشیِ رمز ─────────────────────────────────────────
    def test_forgot_password_flow(self):
        """کدِ یکبارمصرف → ورود → رمزِ تازه → ورود با رمزِ تازه."""
        phone = "09121130009"
        user, _ = User.objects.get_or_create(phone=phone, role=User.Role.STUDENT)
        set_password(user, "قدیمی۱۲۳")

        code = request_otp(phone)["code"]
        signed = self.api.post("/api/v1/auth/verify-otp", {"phone": phone, "code": code},
                               format="json")
        self.assertEqual(signed.status_code, 200)
        token = signed.json()["data"]["accessToken"]

        self.api.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        self.api.post("/api/v1/auth/set-password", {"password": "تازه۴۵۶"}, format="json")
        self.api.credentials()

        self.assertEqual(
            self.api.post("/api/v1/auth/login", {"phone": phone, "password": "تازه۴۵۶"},
                          format="json").status_code, 200)
        self.assertEqual(
            self.api.post("/api/v1/auth/login", {"phone": phone, "password": "قدیمی۱۲۳"},
                          format="json").status_code, 400)

    # ── تأییدِ اختیاریِ شماره ────────────────────────────────
    def test_phone_verification_is_optional_and_works(self):
        phone = "09121130010"
        token = self._register(phone).json()["data"]["accessToken"]
        user = User.objects.get(phone=phone, role=User.Role.STUDENT)
        self.assertFalse(user.phone_verified)

        code = request_otp(phone)["code"]
        self.api.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        res = self.api.post("/api/v1/auth/verify-phone", {"code": code}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json()["data"]["phoneVerified"])
        user.refresh_from_db()
        self.assertTrue(user.phone_verified)
        self.assertIsNotNone(user.phone_verified_at)

    def test_wrong_verification_code_leaves_phone_unverified(self):
        phone = "09121130011"
        token = self._register(phone).json()["data"]["accessToken"]
        request_otp(phone)
        self.api.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        res = self.api.post("/api/v1/auth/verify-phone", {"code": "00000"}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertFalse(User.objects.get(phone=phone, role=User.Role.STUDENT).phone_verified)


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

@override_settings(SMS_BACKEND="console", PASSWORD_VAULT_KEY="test-vault-key")
class RegisterNameTests(TestCase):
    """نامِ ثبت‌نام باید واقعاً ذخیره شود — پارسر کلیدها را snake_case می‌کند."""

    def setUp(self):
        cache.clear()
        self.client = APIClient()

    def test_camel_case_name_is_stored(self):
        res = self.client.post("/api/v1/auth/register",
                               {"phone": "09121230001", "firstName": "سارا",
                                "role": "student"}, format="json")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(User.objects.get(phone="09121230001", role="student").first_name, "سارا")

    def test_snake_case_name_also_works(self):
        res = self.client.post("/api/v1/auth/register",
                               {"phone": "09121230002", "first_name": "مهدی",
                                "role": "parent"}, format="json")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(User.objects.get(phone="09121230002", role="parent").first_name, "مهدی")

    def test_name_comes_back_in_response(self):
        res = self.client.post("/api/v1/auth/register",
                               {"phone": "09121230003", "firstName": "نگار",
                                "role": "student"}, format="json")
        self.assertEqual(res.json()["data"]["user"]["firstName"], "نگار")

    def test_registering_without_a_name_is_fine(self):
        res = self.client.post("/api/v1/auth/register",
                               {"phone": "09121230004", "role": "student"}, format="json")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(User.objects.get(phone="09121230004").first_name, "")

    def test_overlong_name_is_rejected(self):
        res = self.client.post("/api/v1/auth/register",
                               {"phone": "09121230005", "firstName": "ن" * 40,
                                "role": "student"}, format="json")
        self.assertEqual(res.status_code, 400)
