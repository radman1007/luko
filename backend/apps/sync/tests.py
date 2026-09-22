"""همگام‌سازیِ داده‌ی دستگاه — دو دستگاهِ یک حساب همان را می‌بینند و روی هم نمی‌نویسند."""
from datetime import timedelta
from unittest.mock import patch

from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework.throttling import ScopedRateThrottle

from apps.accounts.models import User
from apps.sync import views
from apps.sync.models import KidData
from apps.sync.views import MAX_VALUE

URL = "/api/v1/sync"


class AccountSyncTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.kid = User.objects.create(phone="09121116001", role=User.Role.STUDENT)
        cls.other = User.objects.create(phone="09121116002", role=User.Role.STUDENT)
        cls.parent = User.objects.create(phone="09121116003", role=User.Role.PARENT)

    def setUp(self):
        self.api = APIClient()
        self.api.force_authenticate(self.kid)

    def push(self, *changes):
        body = {"changes": [{"key": k, "value": v, "baseVersion": b} for k, v, b in changes]}
        return self.api.post(URL, body, format="json")

    def pull(self, since=None):
        res = self.api.get(URL, {"since": since} if since else {})
        self.assertEqual(res.status_code, 200)
        return res.json()["data"]

    def test_write_then_read_back_unchanged(self):
        garden = '{"dew":40,"plants":[{"id":"p1","care":3}],"last_refill":1}'
        res = self.push(("luko_coins", "510", 0), ("luko_garden_state", garden, 0))
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["data"], {
            "applied": [{"key": "luko_coins", "version": 1}, {"key": "luko_garden_state", "version": 1}],
            "conflicts": [],
        })
        items = {i["key"]: i for i in self.pull()["items"]}
        # کلید و مقدار دست نمی‌خورند (renderer نباید «luko_coins» یا JSONِ داخلش را camelCase کند)
        self.assertEqual(items["luko_coins"], {"key": "luko_coins", "value": "510", "version": 1})
        self.assertEqual(items["luko_garden_state"]["value"], garden)

    def test_stale_version_is_rejected_with_the_current_value(self):
        self.push(("luko_coins", "500", 0))
        self.push(("luko_coins", "520", 1))            # دستگاهِ الف
        res = self.push(("luko_coins", "480", 1))      # دستگاهِ ب هنوز نسخه‌ی ۱ را دیده
        data = res.json()["data"]
        self.assertEqual(data["applied"], [])
        self.assertEqual(data["conflicts"], [{"key": "luko_coins", "value": "520", "version": 2}])
        self.assertEqual(KidData.objects.get(user=self.kid, key="luko_coins").value, "520")

    def test_new_key_that_already_exists_is_a_conflict(self):
        self.push(("luko_settings", '{"sound":true}', 0))
        res = self.push(("luko_settings", '{"sound":false}', 0))
        self.assertEqual(res.json()["data"]["conflicts"][0]["version"], 1)

    def test_delete_leaves_a_tombstone_other_devices_can_see(self):
        self.push(("fc2", "90", 0))
        self.push(("fc2", None, 1))
        items = {i["key"]: i for i in self.pull()["items"]}
        self.assertEqual(items["fc2"], {"key": "fc2", "value": None, "version": 2})

    def test_since_returns_only_changes_after_it(self):
        self.push(("a.key", "1", 0))
        KidData.objects.filter(key="a.key").update(updated_at=timezone.now() - timedelta(minutes=5))
        since = (timezone.now() - timedelta(minutes=1)).isoformat()
        self.push(("b.key", "2", 0))
        self.assertEqual([i["key"] for i in self.pull(since)["items"]], ["b.key"])
        self.assertEqual(self.api.get(URL, {"since": "nope"}).status_code, 400)

    def test_since_overlaps_so_a_concurrent_write_is_not_missed(self):
        since = self.pull()["since"]
        self.assertLess(since, timezone.now().isoformat())

    def test_accounts_are_isolated(self):
        self.push(("luko_coins", "999", 0))
        self.api.force_authenticate(self.other)
        self.assertEqual(self.pull()["items"], [])
        self.assertEqual(self.push(("luko_coins", "5", 0)).json()["data"]["applied"][0]["version"], 1)
        self.assertEqual(KidData.objects.get(user=self.kid, key="luko_coins").value, "999")

    def test_only_logged_in_kids(self):
        self.api.force_authenticate(self.parent)
        self.assertEqual(self.api.get(URL).status_code, 403)
        self.api.force_authenticate(None)
        self.assertEqual(self.api.get(URL).status_code, 401)

    def test_bad_input_is_rejected_and_nothing_is_written(self):
        cases = [
            {"changes": []},
            {"changes": "x"},
            {"changes": [{"key": "bad key!", "value": "1", "baseVersion": 0}]},
            {"changes": [{"key": "k", "value": 5, "baseVersion": 0}]},
            {"changes": [{"key": "k", "value": "1", "baseVersion": -1}]},
            {"changes": [{"key": "k", "value": "1", "baseVersion": True}]},
            {"changes": [{"key": "k", "value": "1", "baseVersion": 0}, {"key": "k", "value": "2", "baseVersion": 0}]},
            {"changes": [{"key": "k", "value": "x" * (MAX_VALUE + 1), "baseVersion": 0}]},
        ]
        for body in cases:
            with self.subTest(body=str(body)[:60]):
                self.assertEqual(self.api.post(URL, body, format="json").status_code, 400)
        self.assertFalse(KidData.objects.exists())

    def test_account_quota(self):
        with patch.object(views, "MAX_TOTAL", 10):
            res = self.push(("luko_art_log", "x" * 11, 0))
        self.assertEqual(res.status_code, 413)
        self.assertFalse(KidData.objects.exists())  # کلِ درخواست برگشت خورد

    def test_throttled(self):
        cache.clear()
        with patch.object(ScopedRateThrottle, "THROTTLE_RATES", {"sync": "2/minute"}):
            codes = [self.api.get(URL).status_code for _ in range(3)]
        cache.clear()
        self.assertEqual(codes, [200, 200, 429])
