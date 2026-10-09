from datetime import timedelta

from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User

from .models import ActivitySlot
from .services import ONLINE_WINDOW, KEEP_DAYS, daily, hour_start, hourly, online_now, prune, record_beat, totals

DEVICE = "a1b2c3d4-0000-4000-8000-1234567890ab"


class BeatTests(TestCase):
    def setUp(self):
        cache.clear()
        self.api = APIClient()
        self.kid = User.objects.create_user("09120008001", role="student")
        self.parent = User.objects.create_user("09120008002", role="parent")

    def test_guest_beat_needs_a_device_id(self):
        res = self.api.post("/api/v1/presence/beat", {"platform": "web", "device": DEVICE}, format="json")
        self.assertEqual(res.status_code, 200)
        slot = ActivitySlot.objects.get()
        self.assertEqual((slot.visitor, slot.audience, slot.platform, slot.minutes),
                         (f"g:{DEVICE}", "guest", "web", 1))
        bad = self.api.post("/api/v1/presence/beat", {"platform": "web"}, format="json")
        self.assertEqual(bad.status_code, 400)
        bad = self.api.post("/api/v1/presence/beat", {"platform": "ios", "device": DEVICE}, format="json")
        self.assertEqual(bad.status_code, 400)

    def test_logged_in_beat_counts_the_user_and_sets_last_seen(self):
        self.api.force_authenticate(self.kid)
        res = self.api.post("/api/v1/presence/beat", {"platform": "android"}, format="json")
        self.assertEqual(res.status_code, 200)
        slot = ActivitySlot.objects.get()
        self.assertEqual((slot.visitor, slot.audience, slot.user_id), (f"u:{self.kid.id}", "student", self.kid.id))
        self.kid.refresh_from_db()
        self.assertIsNotNone(self.kid.last_seen_at)
        self.assertEqual(self.kid.last_seen_platform, "android")

    def test_one_minute_per_minute_even_with_two_tabs(self):
        t0 = timezone.now().replace(minute=5, second=0, microsecond=0)
        record_beat(user=self.kid, device="", platform="web", now=t0)
        record_beat(user=self.kid, device="", platform="web", now=t0 + timedelta(seconds=10))  # تبِ دوم
        record_beat(user=self.kid, device="", platform="web", now=t0 + timedelta(seconds=61))
        record_beat(user=self.kid, device="", platform="web", now=t0 + timedelta(seconds=122))
        self.assertEqual(ActivitySlot.objects.get().minutes, 3)

    def test_new_hour_new_slot_and_platforms_are_separate(self):
        t0 = timezone.localtime().replace(minute=59, second=0, microsecond=0)   # مرزِ ساعتِ تهران
        record_beat(user=self.kid, device="", platform="web", now=t0)
        record_beat(user=self.kid, device="", platform="web", now=t0 + timedelta(minutes=2))
        record_beat(user=self.kid, device="", platform="android", now=t0 + timedelta(minutes=2))
        self.assertEqual(ActivitySlot.objects.count(), 3)

    def test_hours_follow_tehran_clock(self):
        # ۰۶:۳۰ UTC = ۱۰:۰۰ تهران — مرزِ ساعت باید روی ساعتِ تهران باشد
        moment = timezone.now().replace(hour=6, minute=40, second=0, microsecond=0)
        start = timezone.localtime(hour_start(moment))
        self.assertEqual((start.minute, start.second), (0, 0))
        self.assertEqual(start.hour, timezone.localtime(moment).hour)


class StatsTests(TestCase):
    def setUp(self):
        # ظهرِ تهران: نزدیکِ نیمه‌شب «امروز» دو تکه می‌شد و تست شانسی می‌شد
        self.now = timezone.localtime().replace(hour=12, minute=30, second=0, microsecond=0)
        self.kid = User.objects.create_user("09120008011", role="student")
        self.kid2 = User.objects.create_user("09120008012", role="student")
        self.parent = User.objects.create_user("09120008013", role="parent")

    def beat(self, user, platform, minutes_ago, device=""):
        record_beat(user=user, device=device, platform=platform, now=self.now - timedelta(minutes=minutes_ago))

    def test_online_now_by_platform_and_kind(self):
        self.beat(self.kid, "web", 1)
        self.beat(self.kid, "android", 1)        # یک بچه روی دو سکو
        self.beat(self.parent, "web", 0)
        self.beat(None, "web", 0, device=DEVICE)
        self.beat(self.kid2, "web", 10)          # قدیمی‌تر از پنجره
        online = online_now(self.now)
        self.assertEqual(online, {"web": 3, "android": 1, "total": 3, "users": 2, "guests": 1})
        self.assertLess(ONLINE_WINDOW, timedelta(minutes=10))

    def test_daily_counts_unique_visitors_and_average_minutes(self):
        for m in range(9, -1, -1):                # ۱۰ دقیقه بچه‌ی اول (هر ۶۱ ثانیه، به ترتیبِ زمان)
            record_beat(user=self.kid, device="", platform="web",
                        now=self.now - timedelta(seconds=61 * m))
        for m in range(3, -1, -1):                # ۴ دقیقه بچه‌ی دوم
            record_beat(user=self.kid2, device="", platform="android",
                        now=self.now - timedelta(seconds=61 * m))
        rows = daily(7, now=self.now)
        today = rows[-1]
        self.assertEqual(len(rows), 7)
        self.assertEqual(today["day"], timezone.localdate(self.now))
        self.assertEqual((today["visitors"], today["minutes"]), (2, 14))
        self.assertEqual(today["avg_minutes"], 7.0)
        self.assertEqual(daily(7, platform="android", now=self.now)[-1]["visitors"], 1)
        self.assertEqual(daily(7, audience="parent", now=self.now)[-1]["visitors"], 0)
        t = totals(self.now - timedelta(days=1))
        self.assertEqual((t["visitors"], t["minutes"], t["avg_minutes"]), (2, 14, 7.0))

    def test_hourly_has_every_hour(self):
        self.beat(self.kid, "web", 0)
        self.beat(self.parent, "web", 125)
        rows = hourly(24, now=self.now)
        self.assertEqual(len(rows), 24)
        self.assertEqual(rows[-1]["visitors"], 1)
        self.assertEqual(sum(r["visitors"] for r in rows), 2)

    def test_prune_keeps_recent(self):
        self.beat(self.kid, "web", 0)
        ActivitySlot.objects.create(visitor="g:old-device-1", audience="guest", platform="web",
                                    hour=self.now - timedelta(days=KEEP_DAYS + 3), last_beat=self.now)
        self.assertEqual(prune(self.now), 1)
        self.assertEqual(ActivitySlot.objects.count(), 1)
