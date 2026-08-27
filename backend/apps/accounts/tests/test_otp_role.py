"""نقشِ حساب هنگامِ ورود با OTP — پایه‌ی صفحه‌ی ورودِ جداگانه‌ی والدین."""
from django.test import TestCase, override_settings
from django.core.cache import cache
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.accounts.otp import request_otp


@override_settings(SMS_BACKEND="console")
class OtpRoleTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()

    def _code(self, phone):
        return request_otp(phone)["code"]

    def test_parent_signup_creates_parent(self):
        phone = "09121110101"
        code = self._code(phone)
        res = self.client.post("/api/v1/auth/verify-otp",
                               {"phone": phone, "code": code, "role": "parent",
                                "firstName": "رادمان"}, format="json")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.json()["data"]["user"]["role"], "parent")
        self.assertEqual(User.objects.get(phone=phone).role, User.Role.PARENT)

    def test_default_signup_is_student(self):
        phone = "09121110102"
        res = self.client.post("/api/v1/auth/verify-otp",
                               {"phone": phone, "code": self._code(phone)}, format="json")
        self.assertEqual(res.json()["data"]["user"]["role"], "student")

    def test_existing_student_cannot_become_parent(self):
        """مهم‌ترین تست: ورود از صفحه‌ی والدین نباید نقشِ حسابِ موجود را عوض کند."""
        phone = "09121110103"
        User.objects.create(phone=phone, role=User.Role.STUDENT, first_name="بچه")
        res = self.client.post("/api/v1/auth/verify-otp",
                               {"phone": phone, "code": self._code(phone), "role": "parent"},
                               format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["data"]["user"]["role"], "student")
        self.assertEqual(User.objects.get(phone=phone).role, User.Role.STUDENT)

    def test_staff_roles_are_rejected(self):
        """نقش‌های کارکنان هرگز از سمتِ کاربر ساخته نمی‌شوند."""
        phone = "09121110104"
        code = self._code(phone)          # یک‌بار درخواست؛ درخواستِ پیاپی محدود است
        for role in ("team_admin", "teacher", "school_admin"):
            res = self.client.post("/api/v1/auth/verify-otp",
                                   {"phone": phone, "code": code, "role": role},
                                   format="json")
            # سریالایزر قبل از بررسیِ کد ردش می‌کند، پس کد مصرف نمی‌شود
            self.assertEqual(res.status_code, 400, role)
        self.assertFalse(User.objects.filter(phone=phone).exists())
