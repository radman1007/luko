"""
نقشِ حساب هنگامِ ورود با OTP.

سناریوی واقعی: بیشترِ بچه‌ها با شماره‌ی پدر/مادرشان ثبت‌نام می‌کنند. پس یک
شماره باید هم‌زمان یک حسابِ دانش‌آموز و یک حسابِ والد داشته باشد، و ورود از
هر صفحه به حسابِ خودش برسد بدون اینکه به آن یکی دست بزند.
"""
from django.db import IntegrityError, transaction
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

    def _login(self, phone, role=None, **extra):
        body = {"phone": phone, "code": self._code(phone), **extra}
        if role:
            body["role"] = role
        return self.client.post("/api/v1/auth/verify-otp", body, format="json")

    def test_parent_signup_creates_parent(self):
        phone = "09121110101"
        res = self._login(phone, "parent", firstName="رادمان")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.json()["data"]["user"]["role"], "parent")
        self.assertEqual(User.objects.get(phone=phone, role=User.Role.PARENT).first_name, "رادمان")

    def test_default_signup_is_student(self):
        phone = "09121110102"
        self.assertEqual(self._login(phone).json()["data"]["user"]["role"], "student")

    def test_one_phone_holds_both_a_child_and_a_parent_account(self):
        """قلبِ ماجرا: بچه با شماره‌ی مادرش ثبت‌نام کرده و مادر هم وارد پنل می‌شود."""
        phone = "09121110103"
        kid = User.objects.create(phone=phone, role=User.Role.STUDENT, first_name="بچه")

        res = self._login(phone, "parent", firstName="مادر")
        self.assertEqual(res.status_code, 201)          # حسابِ تازه، نه همان بچه
        parent_id = res.json()["data"]["user"]["id"]

        self.assertNotEqual(str(kid.id), str(parent_id))
        self.assertEqual(res.json()["data"]["user"]["role"], "parent")
        # حسابِ بچه هیچ تغییری نکرده
        kid.refresh_from_db()
        self.assertEqual(kid.role, User.Role.STUDENT)
        self.assertEqual(kid.first_name, "بچه")
        self.assertEqual(User.objects.filter(phone=phone).count(), 2)

    def test_child_login_after_parent_login_returns_the_child(self):
        """ورودِ بچه با همان شماره باید به حسابِ خودش برسد، نه حسابِ والد."""
        phone = "09121110104"
        parent_id = self._login(phone, "parent").json()["data"]["user"]["id"]
        cache.clear()
        res = self._login(phone)                        # بدون نقش ⇒ دانش‌آموز
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.json()["data"]["user"]["role"], "student")
        self.assertNotEqual(res.json()["data"]["user"]["id"], parent_id)

    def test_repeat_login_reuses_the_same_account(self):
        """ورودِ دوباره نباید حسابِ تکراری بسازد."""
        phone = "09121110105"
        first = self._login(phone, "parent")
        cache.clear()
        second = self._login(phone, "parent")
        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 200)       # ۲۰۰ = حسابِ موجود
        self.assertEqual(first.json()["data"]["user"]["id"],
                         second.json()["data"]["user"]["id"])
        self.assertEqual(User.objects.filter(phone=phone).count(), 1)

    def test_staff_roles_are_rejected(self):
        """نقش‌های کارکنان هرگز از سمتِ کاربر ساخته نمی‌شوند."""
        phone = "09121110106"
        code = self._code(phone)          # یک‌بار درخواست؛ درخواستِ پیاپی محدود است
        for role in ("team_admin", "teacher", "school_admin"):
            res = self.client.post("/api/v1/auth/verify-otp",
                                   {"phone": phone, "code": code, "role": role},
                                   format="json")
            # سریالایزر قبل از بررسیِ کد ردش می‌کند، پس کد مصرف نمی‌شود
            self.assertEqual(res.status_code, 400, role)
        self.assertFalse(User.objects.filter(phone=phone).exists())

    def test_same_phone_and_role_stays_unique(self):
        """یکتایی از شماره به جفتِ (شماره، نقش) منتقل شده، نه اینکه برداشته شده باشد."""
        phone = "09121110107"
        User.objects.create(phone=phone, role=User.Role.STUDENT)
        with self.assertRaises(IntegrityError), transaction.atomic():
            User.objects.create(phone=phone, role=User.Role.STUDENT)

    def test_admin_password_login_prefers_the_staff_account(self):
        """اگر شماره‌ی ادمین با یک بچه یکی باشد، ورودِ رمزدار باید ادمین را بیاورد."""
        phone = "09121110108"
        User.objects.create(phone=phone, role=User.Role.STUDENT)
        admin = User.objects.create_superuser(phone=phone, password="x")
        self.assertEqual(User.objects.get_by_natural_key(phone).id, admin.id)
