"""
تستِ دودیِ پنلِ ادمین: هر صفحه‌ای که تیم باز می‌کند باید ۲۰۰ بدهد.

چرا لازم است: خطای پنل در تستِ APIها دیده نمی‌شود و معمولاً وقتی معلوم
می‌شود که کسی وسطِ کار به آن برمی‌خورد. این‌جا فهرست و فرمِ همه‌ی مدل‌های
ثبت‌شده یک‌بار رندر می‌شوند تا هر شکستنی همان موقع پیدا شود.
"""
import sys

import django
from django.contrib import admin
from django.test import TestCase
from django.urls import reverse

from apps.accounts.models import User

# جنگو ۵٫۱ روی پایتون ۳٫۱۴ قالب‌های ادمین را رندر نمی‌کند
# (`'super' object has no attribute 'dicts'`). production روی ۳٫۱۲ است؛
# این پرش فقط برای ماشینِ توسعه‌دهنده‌ای است که پایتونِ جلوتر دارد.
BROKEN_TEMPLATES = sys.version_info >= (3, 14) and django.VERSION < (5, 2)
SKIP_WHY = (f"جنگو {django.get_version()} روی پایتون "
            f"{'.'.join(map(str, sys.version_info[:2]))} قالبِ ادمین را رندر نمی‌کند؛ "
            f"سرور روی ۳٫۱۲ است.")


class AdminSmokeTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.boss = User.objects.create(
            phone="09120000777", role=User.Role.TEAM_ADMIN,
            first_name="سوپرادمین", is_staff=True, is_superuser=True)
        cls.boss.set_password("raz-admin-1")
        cls.boss.save()

    def setUp(self):
        self.client.force_login(self.boss)

    def test_the_index_lists_every_app_in_persian(self):
        if BROKEN_TEMPLATES:
            self.skipTest(SKIP_WHY)
        res = self.client.get(reverse("admin:index"))
        self.assertEqual(res.status_code, 200)
        body = res.content.decode()
        for label in ("کاربران و حساب‌ها", "پنل والدین", "زمان‌بندیِ کارهای خودکار"):
            self.assertIn(label, body)

    def test_no_english_app_headings_slip_through(self):
        """اپ‌های بیرونی ترجمه‌ی فارسی ندارند و باید در فهرست بازنویسی شوند."""
        if BROKEN_TEMPLATES:
            self.skipTest(SKIP_WHY)
        body = self.client.get(reverse("admin:index")).content.decode()
        for leak in ("Periodic Tasks", "PERIODIC TASKS", "Authentication and Authorization"):
            self.assertNotIn(leak, body)

    def test_every_changelist_opens(self):
        if BROKEN_TEMPLATES:
            self.skipTest(SKIP_WHY)
        for model, model_admin in admin.site._registry.items():
            meta = model._meta
            with self.subTest(model=f"{meta.app_label}.{meta.model_name}"):
                url = reverse(f"admin:{meta.app_label}_{meta.model_name}_changelist")
                self.assertEqual(self.client.get(url).status_code, 200)

    def test_every_add_form_opens(self):
        if BROKEN_TEMPLATES:
            self.skipTest(SKIP_WHY)
        for model, model_admin in admin.site._registry.items():
            meta = model._meta
            if not model_admin.has_add_permission(_FakeRequest(self.boss)):
                continue
            with self.subTest(model=f"{meta.app_label}.{meta.model_name}"):
                url = reverse(f"admin:{meta.app_label}_{meta.model_name}_add")
                self.assertEqual(self.client.get(url).status_code, 200)

    def test_search_runs_on_every_searchable_list(self):
        """جست‌وجو روی فیلدِ اشتباه، فقط موقعِ تایپ خطا می‌دهد نه موقعِ باز کردن."""
        if BROKEN_TEMPLATES:
            self.skipTest(SKIP_WHY)
        for model, model_admin in admin.site._registry.items():
            if not getattr(model_admin, "search_fields", None):
                continue
            meta = model._meta
            with self.subTest(model=f"{meta.app_label}.{meta.model_name}"):
                url = reverse(f"admin:{meta.app_label}_{meta.model_name}_changelist")
                self.assertEqual(self.client.get(url, {"q": "0912"}).status_code, 200)


class _FakeRequest:
    """کمترین چیزی که `has_add_permission` لازم دارد."""

    def __init__(self, user):
        self.user = user
        self.method = "GET"


class AdminAccessTests(TestCase):
    """پنل نباید به کسی که حقش نیست باز شود."""

    @classmethod
    def setUpTestData(cls):
        cls.kid = User.objects.create(phone="09120000778", role=User.Role.STUDENT,
                                      first_name="بچه")
        cls.kid.set_password("raz-bache-1")
        cls.kid.save()
        cls.staff = User.objects.create(phone="09120000779", role=User.Role.TEAM_ADMIN,
                                        first_name="کارمند", is_staff=True)
        cls.staff.set_password("raz-karmand")
        cls.staff.save()

    def test_an_anonymous_visitor_is_sent_to_the_login_page(self):
        res = self.client.get(reverse("admin:index"))
        self.assertEqual(res.status_code, 302)
        self.assertIn("login", res["Location"])

    def test_a_child_account_cannot_open_the_panel(self):
        self.client.force_login(self.kid)
        res = self.client.get(reverse("admin:index"))
        self.assertEqual(res.status_code, 302)

    def test_plain_staff_cannot_see_the_password_vault(self):
        """رمزِ خوانا فقط مالِ سوپرادمین است."""
        self.client.force_login(self.staff)
        res = self.client.get(reverse("admin:accounts_passwordvault_changelist"))
        self.assertEqual(res.status_code, 403)
