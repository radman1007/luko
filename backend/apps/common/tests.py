from datetime import date, datetime

from django.test import SimpleTestCase, TestCase

from apps.common.fa import fa_date, fa_day, fa_digits, fa_time, fa_when, to_jalali


class JalaliTests(SimpleTestCase):
    def test_known_dates(self):
        # نوروز و چند تاریخِ شناخته‌شده
        self.assertEqual(to_jalali(date(2026, 3, 21)), (1405, 1, 1))
        self.assertEqual(to_jalali(date(2024, 3, 20)), (1403, 1, 1))
        self.assertEqual(to_jalali(date(2026, 8, 16)), (1405, 5, 25))

    def test_leap_year_end(self):
        # ۳۰ اسفندِ سالِ کبیسه‌ی ۱۴۰۳
        self.assertEqual(to_jalali(date(2025, 3, 20)), (1403, 12, 30))

    def test_fa_date_uses_persian_digits_and_month_name(self):
        self.assertEqual(fa_date(date(2026, 8, 16)), "۲۵ مرداد")
        self.assertEqual(fa_date(date(2026, 8, 16), with_year=True), "۲۵ مرداد ۱۴۰۵")


class FormattingTests(SimpleTestCase):
    def test_fa_digits(self):
        self.assertEqual(fa_digits(1405), "۱۴۰۵")
        self.assertEqual(fa_digits("۸۳٪ از 326 پاسخ"), "۸۳٪ از ۳۲۶ پاسخ")

    def test_fa_time(self):
        self.assertEqual(fa_time(datetime(2026, 8, 16, 18, 37)), "۱۸:۳۷")

    def test_fa_day_relative(self):
        today = date(2026, 8, 16)
        self.assertEqual(fa_day(today, today), "امروز")
        self.assertEqual(fa_day(date(2026, 8, 15), today), "دیروز")
        self.assertEqual(fa_day(date(2026, 8, 13), today), "۳ روز پیش")
        self.assertEqual(fa_day(date(2026, 8, 1), today), "۱۰ مرداد")

    def test_fa_when_joins_day_and_clock(self):
        today = date(2026, 8, 16)
        self.assertEqual(fa_when(datetime(2026, 8, 16, 9, 5), today), "امروز، ۰۹:۰۵")
        self.assertEqual(fa_when(datetime(2026, 8, 15, 21, 40), today), "دیروز، ۲۱:۴۰")


class EnvelopeRendererTests(TestCase):
    """پاکت نباید روی پاسخِ بدونِ محتوا بدنه بگذارد."""

    def setUp(self):
        from apps.accounts.models import User
        from rest_framework.test import APIClient
        self.user = User.objects.create(phone="09121116001", role=User.Role.STUDENT)
        self.api = APIClient()
        self.api.force_authenticate(self.user)

    def test_204_has_an_empty_body(self):
        from apps.health.models import Painting
        painting = Painting.objects.create(user=self.user, thumbnail="x", image="y")
        res = self.api.delete(f"/api/v1/paintings/{painting.id}")
        self.assertEqual(res.status_code, 204)
        self.assertEqual(res.content, b"")
