"""
تجمیع‌های پنلِ والدین روی تگ‌های آموزشی (apps/parent/learning.py و بخش‌های زمانیِ گزارش).
رویدادها از همان مسیرِ واقعی (store_events) وارد می‌شوند.
"""
import uuid
from datetime import timedelta

from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone

from apps.accounts.models import User
from apps.games.models import ConceptTag, GameEvent
from apps.games.telemetry import store_events

from .learning import build_learning
from .services import build_child_report


def ms_ago(**delta) -> int:
    return int((timezone.now() - timedelta(**delta)).timestamp() * 1000)


def answer(tag, correct, attempt=1, error=None, ago=None, **extra):
    item = {"game_slug": "g-math", "event_type": "answer", "event_id": str(uuid.uuid4()),
            "session_id": "s-1", "concept_tag": tag, "is_correct": correct,
            "attempt_number": attempt, "time_taken_ms": 4000, "error_type": error or "",
            "occurred_at": ms_ago(**(ago or {"minutes": 30}))}
    item.update(extra)
    return item


def session_end(session, active_ms, kind="game_end", ago=None):
    return {"game_slug": "g-math", "event_type": kind, "session_id": session,
            "duration_ms": active_ms, "occurred_at": ms_ago(**(ago or {"minutes": 10})),
            "payload": {"accuracy": 50}}


class LearningTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.kid = User.objects.create(phone="09121118001", role=User.Role.STUDENT, first_name="سارا")
        ConceptTag.objects.update_or_create(code="addition_2digit", defaults={"title": "جمعِ دو رقمی", "subject": "math"})
        ConceptTag.objects.update_or_create(code="count", defaults={"title": "شمارش", "subject": "math"})
        ConceptTag.objects.update_or_create(code="retired_tag", defaults={"title": "قدیمی", "is_active": False})

    def setUp(self):
        cache.clear()

    def store(self, items):
        stored, rejected = store_events(self.kid, items)
        self.assertEqual(rejected, 0)

    # ---------------------------------------------------------------- زمانِ بازی
    def test_each_session_is_counted_once(self):
        """هر پنهان‌شدنِ صفحه خلاصه‌ی تجمعیِ همان جلسه را دوباره می‌فرستد"""
        self.store([
            session_end("s-1", 60_000, ago={"minutes": 20}),      # عوض‌کردنِ تب
            session_end("s-1", 120_000, ago={"minutes": 15}),     # دوباره
            session_end("s-1", 180_000, kind="game_complete"),    # بُرد
            {"game_slug": "g-old", "event_type": "game_end", "duration_ms": 60_000,
             "occurred_at": ms_ago(minutes=5)},                    # پلِ قدیمی، بی‌جلسه
        ])
        week = build_learning(self.kid)["week"]
        self.assertEqual(week["minutes"], 4)                       # ۳ + ۱، نه ۷

        report = build_child_report(self.kid)
        self.assertEqual(next(k for k in report["kpis"] if k["key"] == "time")["value"], 4)
        self.assertEqual(sum(day["minutes"] for day in report["week"]), 4)
        self.assertEqual(len(report["sessions"]), 2)               # دو جلسه، نه چهار ردیف

    def test_previous_week_is_separate(self):
        self.store([session_end("s-old", 120_000, ago={"days": 9}), session_end("s-new", 60_000)])
        week = build_learning(self.kid)["week"]
        self.assertEqual((week["minutes"], week["prevMinutes"]), (1, 2))

    def test_offline_event_counts_on_the_day_it_happened(self):
        """رویدادِ آفلاینی که امروز رسیده ولی ده روز پیش رخ داده، در این هفته نیست"""
        self.store([session_end("s-off", 300_000, ago={"days": 10})])
        self.assertEqual(build_learning(self.kid)["week"]["minutes"], 0)

    # ---------------------------------------------------------------- خطاهای هر مفهوم
    def test_errors_per_concept_with_error_types(self):
        self.store([
            answer("addition_2digit", False, error="conceptual"),
            answer("addition_2digit", False, attempt=2, error="conceptual"),
            answer("addition_2digit", False, error="careless"),
            answer("addition_2digit", True, attempt=3),
            answer("count", True),
            answer("count", False),
        ])
        concepts = build_learning(self.kid)["concepts"]
        self.assertEqual([c["tag"] for c in concepts], ["addition_2digit", "count"])   # پرخطاترین اول
        add = concepts[0]
        self.assertEqual((add["label"], add["answers"], add["errors"], add["accuracy"]),
                         ("جمعِ دو رقمی", 4, 3, 25))
        self.assertEqual(add["errorTypes"], [
            {"key": "conceptual", "label": "مفهومی", "count": 2},
            {"key": "careless", "label": "بی‌دقتی", "count": 1},
        ])

    def test_unregistered_and_retired_tags_are_not_shown_to_parents(self):
        self.store([answer("mystery_tag", False), answer("retired_tag", False), answer("count", True)])
        tags = [c["tag"] for c in build_learning(self.kid)["concepts"]]
        self.assertEqual(tags, ["count"])
        report = build_child_report(self.kid)
        self.assertEqual([t["key"] for t in report["topics"]], ["count"])

    def test_hints_are_counted_per_concept(self):
        self.store([answer("count", True),
                    {"game_slug": "g-math", "event_type": "hint", "concept_tag": "count",
                     "occurred_at": ms_ago(minutes=3)}])
        self.assertEqual(build_learning(self.kid)["concepts"][0]["hints"], 1)

    def test_concepts_window_is_eight_weeks(self):
        # رویدادی که نُه هفته پیش رسیده (ورودیِ دیرتر از ۳۰ روز را سرور با زمانِ رسیدن ثبت می‌کند)
        GameEvent.objects.create(user=self.kid, game_slug="g-math", event_type="answer", concept_tag="count",
                                 is_correct=False, occurred_at=timezone.now() - timedelta(weeks=9))
        self.store([answer("count", True)])
        count = build_learning(self.kid)["concepts"][0]
        self.assertEqual((count["answers"], count["errors"]), (1, 0))

    # ---------------------------------------------------------------- اولین تلاش
    def test_first_try_rate_only_uses_known_first_attempts(self):
        self.store([
            answer("count", True), answer("count", True),
            answer("count", False), answer("count", False),
            answer("count", True, attempt=2),                               # تلاشِ دوم: حساب نمی‌شود
            answer("count", True, attempt_number=None),                     # بازیِ بی‌شماره‌ی تلاش
        ])
        week = build_learning(self.kid)["week"]
        self.assertEqual(week["firstTry"], {"asked": 4, "correct": 2, "rate": 50})
        self.assertEqual((week["answers"], week["errors"]), (6, 2))
        self.assertEqual(build_learning(self.kid)["concepts"][0]["firstTryRate"], 50)

    def test_empty_child_has_the_full_shape(self):
        learning = build_learning(self.kid)
        self.assertEqual(learning["week"], {"minutes": 0, "prevMinutes": 0, "answers": 0, "errors": 0,
                                            "firstTry": {"asked": 0, "correct": 0, "rate": 0}})
        self.assertEqual(learning["concepts"], [])
