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


class AdminLoginThrottleTests(TestCase):
    """
    سدِ حدسِ رمز.

    فرمِ ورودِ جنگو خودش هیچ سقفی ندارد؛ بدونِ این، یک اسکریپت شبانه
    هزاران رمز امتحان می‌کند و هیچ‌جا هم صدایش درنمی‌آید.
    """

    URL = "/v1a2n3r4/login/"

    @classmethod
    def setUpTestData(cls):
        cls.boss = User.objects.create(phone="09120000780", role=User.Role.TEAM_ADMIN,
                                       first_name="رئیس", is_staff=True, is_superuser=True)
        cls.boss.set_password("raz-dorost-1")
        cls.boss.save()

    def setUp(self):
        if BROKEN_TEMPLATES:
            self.skipTest(SKIP_WHY)      # فرمِ ورود رندر می‌شود
        from django.core.cache import cache
        cache.clear()

    def _try(self, password="raz-ghalat", phone="09120000780", ip="10.0.0.1"):
        return self.client.post(self.URL, {"username": phone, "password": password},
                                HTTP_X_FORWARDED_FOR=ip)

    def test_a_few_wrong_tries_still_show_the_form(self):
        for _ in range(3):
            self.assertEqual(self._try().status_code, 200)

    def test_too_many_tries_from_one_ip_close_the_door(self):
        from apps.common.admin_site import MAX_FAILURES_PER_IP
        for _ in range(MAX_FAILURES_PER_IP):
            self._try()
        self.assertEqual(self._try().status_code, 429)

    def test_a_spoofed_forwarded_for_does_not_get_around_it(self):
        """
        هدرِ X-Forwarded-For دستِ خودِ کلاینت است، پس شمارنده‌ی IP به‌تنهایی
        کافی نیست؛ شمارنده‌ی حساب باید جلویش را بگیرد.
        """
        from apps.common.admin_site import MAX_FAILURES_PER_ACCOUNT
        for i in range(MAX_FAILURES_PER_ACCOUNT):
            self._try(ip=f"10.0.{i // 250}.{i % 250 + 1}")
        self.assertEqual(self._try(ip="10.9.9.9").status_code, 429)

    def test_one_account_being_hammered_does_not_lock_another(self):
        from apps.common.admin_site import MAX_FAILURES_PER_ACCOUNT
        other = User.objects.create(phone="09120000781", role=User.Role.TEAM_ADMIN,
                                    first_name="دیگری", is_staff=True, is_superuser=True)
        other.set_password("raz-digari-1")
        other.save()
        for i in range(MAX_FAILURES_PER_ACCOUNT + 5):
            self._try(ip=f"10.1.{i // 250}.{i % 250 + 1}")
        res = self.client.post(self.URL,
                               {"username": "09120000781", "password": "raz-digari-1"},
                               HTTP_X_FORWARDED_FOR="10.5.5.5")
        self.assertEqual(res.status_code, 302)

    def test_signing_in_clears_the_counter(self):
        self._try()
        self._try()
        res = self.client.post(self.URL,
                               {"username": "09120000780", "password": "raz-dorost-1"},
                               HTTP_X_FORWARDED_FOR="10.0.0.1")
        self.assertEqual(res.status_code, 302)
        from django.core.cache import cache
        from apps.common.admin_site import _ip_key
        self.assertFalse(cache.get(_ip_key("10.0.0.1")))

    def test_the_right_password_still_fails_once_the_door_is_closed(self):
        """وگرنه سد بی‌معناست: مهاجم آخرین حدسش را می‌زد و رد می‌شد."""
        from apps.common.admin_site import MAX_FAILURES_PER_IP
        for _ in range(MAX_FAILURES_PER_IP):
            self._try()
        res = self.client.post(self.URL,
                               {"username": "09120000780", "password": "raz-dorost-1"},
                               HTTP_X_FORWARDED_FOR="10.0.0.1")
        self.assertEqual(res.status_code, 429)
