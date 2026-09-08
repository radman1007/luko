"""مدیریتِ حسابِ فرزند از پنلِ والدین: رمز و شماره."""
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.accounts.otp import _as_str, _code_key, _conn
from apps.accounts.passwords import set_password

from .models import ParentChild


@override_settings(SMS_BACKEND="console", PASSWORD_VAULT_KEY="test-vault-key")
class ChildPasswordTests(TestCase):
    def setUp(self):
        self.parent = User.objects.create(phone="09121400001", role=User.Role.PARENT)
        self.other = User.objects.create(phone="09121400002", role=User.Role.PARENT)
        self.child = User.objects.create(phone="09121400001", role=User.Role.STUDENT,
                                         first_name="سارا")
        set_password(self.child, "raz-sara")
        ParentChild.objects.create(parent=self.parent, child=self.child)
        self.api = APIClient()
        self.api.force_authenticate(self.parent)

    def test_parent_sees_the_readable_password(self):
        res = self.api.get(f"/api/v1/parent/children/{self.child.id}/password")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["data"]["password"], "raz-sara")

    def test_parent_changes_it(self):
        res = self.api.post(f"/api/v1/parent/children/{self.child.id}/password",
                            {"password": "raz-tazeh"}, format="json")
        self.assertEqual(res.status_code, 200)
        self.child.refresh_from_db()
        self.assertTrue(self.child.check_password("raz-tazeh"))

    def test_the_new_password_is_readable_too(self):
        self.api.post(f"/api/v1/parent/children/{self.child.id}/password",
                      {"password": "raz-tazeh"}, format="json")
        res = self.api.get(f"/api/v1/parent/children/{self.child.id}/password")
        self.assertEqual(res.json()["data"]["password"], "raz-tazeh")

    def test_a_short_password_is_refused(self):
        res = self.api.post(f"/api/v1/parent/children/{self.child.id}/password",
                            {"password": "۱۲"}, format="json")
        self.assertEqual(res.status_code, 400)

    def test_another_parent_cannot_see_it(self):
        api = APIClient()
        api.force_authenticate(self.other)
        self.assertEqual(
            api.get(f"/api/v1/parent/children/{self.child.id}/password").status_code, 404)

    def test_another_parent_cannot_change_it(self):
        api = APIClient()
        api.force_authenticate(self.other)
        res = api.post(f"/api/v1/parent/children/{self.child.id}/password",
                       {"password": "raz-dozdi"}, format="json")
        self.assertEqual(res.status_code, 404)
        self.child.refresh_from_db()
        self.assertTrue(self.child.check_password("raz-sara"))

    def test_a_child_cannot_read_their_own_vault_through_this_route(self):
        """این مسیر فقط برای والد است؛ نقشِ دانش‌آموز نباید بازش کند."""
        api = APIClient()
        api.force_authenticate(self.child)
        self.assertEqual(
            api.get(f"/api/v1/parent/children/{self.child.id}/password").status_code, 403)


@override_settings(SMS_BACKEND="console", PASSWORD_VAULT_KEY="test-vault-key")
class ChildPhoneTests(TestCase):
    """
    تغییرِ شماره‌ی فرزند، دو سر تأیید می‌خواهد.

    هر تست شماره‌ی خودش را می‌سازد: کد و محدودیتِ ارسال روی Redis می‌مانند
    و با شماره‌ی مشترک از تستی به تستِ بعد نشت می‌کنند.
    """

    seq = 0

    def setUp(self):
        ChildPhoneTests.seq += 1
        self.old = f"091214010{ChildPhoneTests.seq:02d}"
        self.new = f"091214020{ChildPhoneTests.seq:02d}"
        self.parent = User.objects.create(phone=self.old, role=User.Role.PARENT)
        self.child = User.objects.create(phone=self.old, role=User.Role.STUDENT)
        ParentChild.objects.create(parent=self.parent, child=self.child)
        # کد و سهمیه‌ی ارسال روی Redis می‌مانند و از اجرایی به اجرای بعد
        # نشت می‌کنند؛ برای همین شماره‌های همین تست پاک می‌شوند.
        conn = _conn()
        for phone in (self.old, self.new):
            conn.delete(f"otp:code:{phone}", f"otp:resend:{phone}", f"otp:att:{phone}")

        self.api = APIClient()
        self.api.force_authenticate(self.parent)
        self.url = f"/api/v1/parent/children/{self.child.id}/phone"

    def _codes(self):
        """
        کدها روی Redis می‌نشینند نه کشِ جنگو، پس از همان‌جا خوانده می‌شوند.
        (پاسخ فقط در حالتِ توسعه کد را برمی‌گرداند و تست‌ها DEBUG ندارند.)
        """
        res = self.api.post(f"{self.url}/start", {"phone": self.new}, format="json")
        self.assertEqual(res.status_code, 200, res.content[:200])
        conn = _conn()
        return (_as_str(conn.get(_code_key(self.old))),
                _as_str(conn.get(_code_key(self.new))))

    def _confirm(self, current, fresh):
        return self.api.post(f"{self.url}/confirm",
                             {"phone": self.new, "currentCode": current, "newCode": fresh},
                             format="json")

    def test_both_sides_must_be_confirmed(self):
        res = self._confirm(*self._codes())
        self.assertEqual(res.status_code, 200, res.content[:200])
        self.child.refresh_from_db()
        self.assertEqual(self.child.phone, self.new)

    def test_a_wrong_current_code_stops_it(self):
        _, fresh = self._codes()
        self.assertEqual(self._confirm("00000", fresh).status_code, 400)
        self.child.refresh_from_db()
        self.assertEqual(self.child.phone, self.old)

    def test_a_wrong_new_code_stops_it(self):
        current, _ = self._codes()
        self.assertEqual(self._confirm(current, "00000").status_code, 400)
        self.child.refresh_from_db()
        self.assertEqual(self.child.phone, self.old)

    def test_the_same_phone_is_refused(self):
        res = self.api.post(f"{self.url}/start", {"phone": self.old}, format="json")
        self.assertEqual(res.status_code, 400)

    def test_an_invalid_phone_is_refused(self):
        res = self.api.post(f"{self.url}/start", {"phone": "۱۲۳"}, format="json")
        self.assertEqual(res.status_code, 400)

    def test_another_parent_cannot_start_it(self):
        stranger = User.objects.create(phone="09121409999", role=User.Role.PARENT)
        api = APIClient()
        api.force_authenticate(stranger)
        self.assertEqual(
            api.post(f"{self.url}/start", {"phone": self.new}, format="json").status_code, 404)

    def test_the_new_phone_counts_as_verified(self):
        self._confirm(*self._codes())
        self.child.refresh_from_db()
        self.assertTrue(self.child.phone_verified)

    def test_moving_to_a_phone_with_a_parent_links_that_family(self):
        newcomer = User.objects.create(phone=self.new, role=User.Role.PARENT)
        self._confirm(*self._codes())
        self.assertTrue(
            ParentChild.objects.filter(parent=newcomer, child=self.child).exists())


@override_settings(SMS_BACKEND="console", PASSWORD_VAULT_KEY="test-vault-key")
class AddChildTests(TestCase):
    def setUp(self):
        self.parent = User.objects.create(phone="09121400020", role=User.Role.PARENT)
        self.api = APIClient()
        self.api.force_authenticate(self.parent)

    def _add(self, **over):
        body = {"phone": "09121400020", "firstName": "سارا", "grade": 2,
                "password": "raz12345"}
        body.update(over)
        return self.api.post("/api/v1/parent/children", body, format="json")

    def test_a_child_is_created_with_grade_and_password(self):
        res = self._add()
        self.assertEqual(res.status_code, 201)
        child = User.objects.get(id=res.json()["data"]["id"])
        self.assertEqual(child.grade, 2)
        self.assertTrue(child.check_password("raz12345"))

    def test_two_children_may_share_the_parent_phone(self):
        self._add(firstName="سارا", password="raz-sara")
        self._add(firstName="نیما", password="raz-nima")
        kids = User.objects.filter(phone="09121400020", role=User.Role.STUDENT)
        self.assertEqual(kids.count(), 2)
        self.assertEqual(ParentChild.objects.filter(parent=self.parent).count(), 2)

    def test_a_password_is_required(self):
        res = self.api.post("/api/v1/parent/children",
                            {"phone": "09121400020", "grade": 1}, format="json")
        self.assertEqual(res.status_code, 400)

    def test_each_sibling_logs_in_with_their_own_password(self):
        self._add(firstName="سارا", password="raz-sara")
        self._add(firstName="نیما", password="raz-nima")
        res = APIClient().post("/api/v1/auth/login",
                               {"phone": "09121400020", "password": "raz-nima",
                                "role": "student"}, format="json")
        self.assertEqual(res.json()["data"]["user"]["firstName"], "نیما")
