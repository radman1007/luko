"""
دریافتِ رویدادهای بازی — قراردادِ نسخه‌ی ۳ (docs/event-tracking-guide.md) و سازگاری با نسخه‌ی ۲.
"""
import uuid
from datetime import timedelta
from unittest import mock

from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework.throttling import ScopedRateThrottle

from apps.accounts.models import User

from .models import GameEvent
from .telemetry import MAX_BATCH, MAX_PAYLOAD_BYTES

URL = "/api/v1/games/events"


def v3(**over):
    """یک پاسخِ غلطِ نسخه‌ی ۳ همان‌طور که اپ (telemetry.ts) می‌فرستد"""
    item = {
        "gameSlug": "g-1a2b3c4d",
        "schemaVersion": 3,
        "eventId": str(uuid.uuid4()),
        "sessionId": "s-lx3k9a-4f2b1c",
        "eventType": "answer",
        "conceptTag": "addition_2digit",
        "occurredAt": int(timezone.now().timestamp() * 1000),
        "level": 2,
        "isCorrect": False,
        "timeTakenMs": 4500,
        "attemptNumber": 2,
        "errorType": "conceptual",
        "hintUsed": False,
        "payload": {"given": "35", "expected": "53", "questionId": "q7"},
    }
    item.update(over)
    return item


class EventIntakeTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.kid = User.objects.create(phone="09121119001", role=User.Role.STUDENT)
        cls.parent = User.objects.create(phone="09121119002", role=User.Role.PARENT)

    def setUp(self):
        cache.clear()                    # شمارنده‌ی throttle
        self.api = APIClient()
        self.api.force_authenticate(self.kid)

    def post(self, body, client=None):
        return (client or self.api).post(URL, body, format="json")

    def test_v3_answer_lands_in_columns(self):
        res = self.post([v3()])
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["data"], {"stored": 1, "rejected": 0})
        e = GameEvent.objects.get()
        self.assertEqual(
            (e.user, e.game_slug, e.event_type, e.concept_tag, e.level, e.is_correct, e.time_taken_ms,
             e.attempt_number, e.error_type, e.hint_used, e.session_id, e.schema_version),
            (self.kid, "g-1a2b3c4d", "answer", "addition_2digit", 2, False, 4500, 2, "conceptual", False,
             "s-lx3k9a-4f2b1c", 3),
        )
        # داده‌ی اضافه دست‌نخورده (کلیدهای camelCase پارسر را snake_case نمی‌کنند)
        self.assertEqual(e.payload, {"given": "35", "expected": "53", "questionId": "q7"})
        self.assertLess(abs((e.occurred_at - timezone.now()).total_seconds()), 5)

    def test_resent_event_is_stored_once(self):
        item = v3()
        self.post([item, item])                      # دوبار در یک دسته
        self.post([item])                            # و دوباره بعد از «قطعیِ شبکه»
        self.assertEqual(GameEvent.objects.count(), 1)

    def test_legacy_v2_item_is_understood(self):
        """صفِ آفلاینِ گوشی‌ها و SDKِ کش‌شده هنوز شکلِ قدیمی را می‌فرستند"""
        at = (timezone.now() - timedelta(hours=3)).isoformat()
        self.post([{"gameSlug": "g-old", "eventType": "answer", "sessionId": "s-old",
                    "payload": {"topic": "count", "correct": True, "ms": 2100, "attempt": 1, "at": at}}])
        e = GameEvent.objects.get()
        self.assertEqual((e.concept_tag, e.is_correct, e.time_taken_ms, e.attempt_number, e.session_id),
                         ("count", True, 2100, 1, "s-old"))
        self.assertLess(abs((e.occurred_at - (timezone.now() - timedelta(hours=3))).total_seconds()), 5)

    def test_session_summary_keeps_active_time(self):
        self.post([{"gameSlug": "g-1", "eventType": "game_end",
                    "payload": {"sessionId": "s-1", "durationMs": 900_000, "activeMs": 600_000}}])
        e = GameEvent.objects.get()
        self.assertEqual((e.duration_ms, e.session_id), (600_000, "s-1"))   # فعال، نه با مکث

    def test_idle_ms_is_not_answer_time(self):
        self.post([{"gameSlug": "g-1", "eventType": "idle", "payload": {"ms": 45_000}}])
        self.assertIsNone(GameEvent.objects.get().time_taken_ms)

    def test_one_broken_item_does_not_lose_the_batch(self):
        res = self.post([v3(), {"eventType": "answer"}, v3(eventType="Bad Type"), "junk", v3()])
        self.assertEqual(res.json()["data"], {"stored": 2, "rejected": 3})
        self.assertEqual(GameEvent.objects.count(), 2)

    def test_bad_values_are_dropped_not_trusted(self):
        self.post([v3(conceptTag="جمع دو رقمی", errorType="lazy", attemptNumber=0, timeTakenMs=5 * 3600_000,
                      isCorrect="yes", eventId="not-a-uuid", sessionId="x y")])
        e = GameEvent.objects.get()
        self.assertEqual((e.concept_tag, e.error_type, e.attempt_number, e.time_taken_ms, e.is_correct,
                          e.event_id, e.session_id), ("", "", None, None, None, None, ""))

    def test_concept_tag_is_lowercased(self):
        self.post([v3(conceptTag="Addition_2Digit")])
        self.assertEqual(GameEvent.objects.get().concept_tag, "addition_2digit")

    def test_clock_in_the_future_or_too_old_uses_arrival_time(self):
        now = timezone.now()
        future = int((now + timedelta(days=2)).timestamp() * 1000)
        ancient = int((now - timedelta(days=90)).timestamp() * 1000)
        offline = int((now - timedelta(days=3)).timestamp() * 1000)
        self.post([v3(occurredAt=future), v3(occurredAt=ancient), v3(occurredAt=offline)])
        times = sorted(GameEvent.objects.values_list("occurred_at", flat=True))
        self.assertLess(abs((times[0] - (now - timedelta(days=3))).total_seconds()), 5)  # آفلاینِ سه‌روزه سرِ جایش
        for at in times[1:]:
            self.assertLess(abs((at - now).total_seconds()), 5)

    def test_oversized_payload_is_replaced(self):
        self.post([v3(payload={"blob": "x" * (MAX_PAYLOAD_BYTES + 10)})])
        e = GameEvent.objects.get()
        self.assertTrue(e.payload["truncated"])
        self.assertEqual(e.concept_tag, "addition_2digit")       # ستون‌ها سالم

    def test_single_object_is_accepted(self):
        self.assertEqual(self.post(v3()).json()["data"]["stored"], 1)

    def test_too_many_items_is_refused(self):
        res = self.post([v3() for _ in range(MAX_BATCH + 1)])
        self.assertEqual(res.status_code, 413)
        self.assertEqual(GameEvent.objects.count(), 0)

    def test_only_students_may_send(self):
        other = APIClient()
        other.force_authenticate(self.parent)
        self.assertEqual(self.post([v3()], client=other).status_code, 403)
        self.assertEqual(self.post([v3()], client=APIClient()).status_code, 401)
        self.assertEqual(GameEvent.objects.count(), 0)

    @mock.patch.object(ScopedRateThrottle, "THROTTLE_RATES", {"game_events": "2/hour"})
    def test_throttled_after_the_rate(self):
        codes = [self.post([v3()]).status_code for _ in range(3)]
        self.assertEqual(codes, [200, 200, 429])    # ۴۲۹ برای اپ «موقت» است: صف نگه‌شان می‌دارد

    def test_direct_orm_rows_get_columns_from_payload(self):
        """رویدادی که مستقیم ساخته شود (شل، اسکریپت) هم در گزارش دیده می‌شود"""
        e = GameEvent.objects.create(user=self.kid, game_slug="g-1", event_type="answer",
                                     payload={"topic": "sort", "correct": False, "ms": 1500})
        e.refresh_from_db()
        self.assertEqual((e.concept_tag, e.is_correct, e.time_taken_ms), ("sort", False, 1500))
        self.assertIsNotNone(e.occurred_at)

    def test_whole_batch_is_one_insert(self):
        """بازی و سرور منتظر نمانند: کلِ دسته یک کوئری است (throttle و کشِ گزارش در Redis)"""
        with self.assertNumQueries(1):
            self.post([v3() for _ in range(50)])
        self.assertEqual(GameEvent.objects.count(), 50)
