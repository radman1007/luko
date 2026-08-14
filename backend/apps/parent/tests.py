"""
تست‌های پنل والدین: دسترسی (فقط فرزندِ خودش) و درستیِ محاسبه‌های گزارش.

    USE_SQLITE=1 python manage.py test apps.parent
"""
from django.test import TestCase
from rest_framework.test import APIClient
from django.utils import timezone

from apps.accounts.models import User
from apps.games.models import Book, Game, GameCompletion, GameEvent
from apps.health.models import BreathingSession, MoodCheckin

from .models import ParentChild
from .services import build_child_report


class ReportTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.parent = User.objects.create(phone="09120000001", role=User.Role.PARENT)
        cls.other_parent = User.objects.create(phone="09120000002", role=User.Role.PARENT)
        cls.child = User.objects.create(phone="09120000003", role=User.Role.STUDENT)
        ParentChild.objects.create(parent=cls.parent, child=cls.child, grade=3)

        Book.objects.create(book_id="math-1", title="ریاضی اول", subject="ریاضی", grade=1)
        Game.objects.create(slug="math-1-1", title="بازی یک", book_id="math-1",
                            order=1, coin_reward=10)
        Game.objects.create(slug="math-1-2", title="بازی دو", book_id="math-1",
                            order=2, coin_reward=12)

        events = [
            ("game_start", {}),
            ("answer", {"topic": "sort", "correct": True, "ms": 3000}),
            ("answer", {"topic": "sort", "correct": True, "ms": 3200}),
            ("answer", {"topic": "count", "correct": False, "ms": 9000}),
            ("hint", {"topic": "count"}),
            ("game_end", {"durationMs": 300_000, "accuracy": 67}),
        ]
        for event_type, payload in events:
            GameEvent.objects.create(user=cls.child, game_slug="math-1-1",
                                     event_type=event_type, payload=payload)
        GameCompletion.objects.create(user=cls.child, game_slug="math-1-1", coins_awarded=10)
        MoodCheckin.objects.create(user=cls.child, mood="happy")
        BreathingSession.objects.create(user=cls.child, cycles=3, seconds=90)

    # ---------- محاسبه‌ها ----------
    def test_report_has_every_section_the_panel_needs(self):
        report = build_child_report(self.child)
        self.assertEqual(
            set(report),
            {"childId", "kpis", "week", "accuracyTrend", "subjects", "games",
             "moods", "insights", "wellbeing"},
        )

    def test_minutes_come_from_camelcase_payload(self):
        """اگر پارسر دوباره کلیدها را snake_case کند، این تست می‌افتد."""
        report = build_child_report(self.child)
        time_kpi = next(k for k in report["kpis"] if k["key"] == "time")
        self.assertEqual(time_kpi["value"], 5)          # ۳۰۰ ثانیه = ۵ دقیقه

    def test_accuracy_and_subject_mastery(self):
        report = build_child_report(self.child)
        accuracy = next(k for k in report["kpis"] if k["key"] == "accuracy")
        self.assertEqual(accuracy["value"], 67)         # ۲ از ۳
        math = next(s for s in report["subjects"] if s["label"] == "ریاضی")
        self.assertEqual(math["mastery"], 67)
        self.assertEqual(math["gamesDone"], 1)
        self.assertEqual(math["gamesTotal"], 2)
        self.assertEqual(math["weakestTopic"], "شمارش")

    def test_per_game_row_counts_hints_and_time(self):
        report = build_child_report(self.child)
        row = next(g for g in report["games"] if g["id"] == "math-1-1")
        self.assertEqual(row["attempts"], 1)
        self.assertEqual(row["hints"], 1)
        self.assertEqual(row["totalMinutes"], 5)
        self.assertEqual(row["coins"], 10)
        self.assertEqual(row["status"], "progress")

    def test_untouched_games_are_listed_too(self):
        report = build_child_report(self.child)
        row = next(g for g in report["games"] if g["id"] == "math-1-2")
        self.assertEqual(row["status"], "untouched")

    def test_week_has_seven_days_starting_saturday(self):
        report = build_child_report(self.child)
        self.assertEqual(len(report["week"]), 7)
        self.assertEqual(report["week"][-1]["day"], self._today_label())

    def test_wellbeing_counts(self):
        wellbeing = build_child_report(self.child)["wellbeing"]
        self.assertEqual(wellbeing["checkins"], 1)
        self.assertEqual(wellbeing["breathingSessions"], 1)
        self.assertEqual(wellbeing["dominantMood"], "happy")

    def test_insight_never_praises_a_weak_topic(self):
        insights = build_child_report(self.child)["insights"]
        good = [i for i in insights if i["tone"] == "good"]
        self.assertTrue(all("شمارش" not in i["title"] for i in good))

    def test_child_without_data_still_returns_full_shape(self):
        empty = User.objects.create(phone="09120000009", role=User.Role.STUDENT)
        report = build_child_report(empty)
        self.assertEqual(len(report["kpis"]), 6)
        self.assertEqual(len(report["week"]), 7)
        self.assertEqual(report["moods"], [])

    @staticmethod
    def _today_label():
        from .services import WEEK_DAYS, _saturday_index
        return WEEK_DAYS[_saturday_index(timezone.localdate())]


class AccessTests(TestCase):
    """
    احراز هویتِ پروژه فقط JWT است، پس اینجا از APIClient و force_authenticate
    استفاده می‌کنیم؛ force_login جنگو (سشن‌محور) برای DRF کار نمی‌کند.
    """

    @classmethod
    def setUpTestData(cls):
        cls.parent = User.objects.create(phone="09130000001", role=User.Role.PARENT)
        cls.stranger = User.objects.create(phone="09130000002", role=User.Role.PARENT)
        cls.student = User.objects.create(phone="09130000003", role=User.Role.STUDENT)
        cls.child = User.objects.create(phone="09130000004", role=User.Role.STUDENT)
        ParentChild.objects.create(parent=cls.parent, child=cls.child)

    def setUp(self):
        self.api = APIClient()

    def test_anonymous_is_rejected(self):
        self.assertEqual(self.api.get("/api/v1/parent/children").status_code, 401)

    def test_student_cannot_open_parent_panel(self):
        self.api.force_authenticate(self.student)
        self.assertEqual(self.api.get("/api/v1/parent/children").status_code, 403)

    def test_parent_cannot_read_another_parents_child(self):
        self.api.force_authenticate(self.stranger)
        response = self.api.get(f"/api/v1/parent/children/{self.child.id}/report")
        self.assertEqual(response.status_code, 404)

    def test_parent_reads_own_child(self):
        self.api.force_authenticate(self.parent)
        response = self.api.get(f"/api/v1/parent/children/{self.child.id}/report")
        self.assertEqual(response.status_code, 200)

    def test_parent_cannot_add_a_non_student_as_child(self):
        self.api.force_authenticate(self.parent)
        response = self.api.post("/api/v1/parent/children",
                                 {"phone": self.stranger.phone}, format="json")
        self.assertEqual(response.status_code, 400)
