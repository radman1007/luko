"""
خانه‌ی پنلِ والدین: گزارشِ هفتگیِ خودکار، پیشنهادِ این هفته و قفلِ اشتراک روی درس‌ها.
"""
import uuid
from datetime import date, timedelta

from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.billing.services import gift_subscription
from apps.games.models import Book, ConceptTag, Game, GameCompletion
from apps.games.telemetry import store_events

from .gating import gate_report
from .models import ParentChild
from .services import build_child_report
from .weekly import period_label


def ms_ago(**delta) -> int:
    return int((timezone.now() - timedelta(**delta)).timestamp() * 1000)


def answer(slug, tag, correct, ago=None):
    return {"game_slug": slug, "event_type": "answer", "event_id": str(uuid.uuid4()), "session_id": "s-1",
            "concept_tag": tag, "is_correct": correct, "attempt_number": 1, "time_taken_ms": 3000,
            "occurred_at": ms_ago(**(ago or {"hours": 2}))}


class HomeReportTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.kid = User.objects.create(phone="09121117001", role=User.Role.STUDENT, first_name="سارا", grade=1)
        cls.parent = User.objects.create(phone="09121117002", role=User.Role.PARENT, first_name="مریم")
        cls.admin = User.objects.create(phone="09121117003", role=User.Role.TEAM_ADMIN, is_staff=True)
        ParentChild.objects.create(parent=cls.parent, child=cls.kid)
        Book.objects.update_or_create(book_id="math-1", defaults={"title": "ریاضی ۱", "subject": "ریاضی", "grade": 1})
        Book.objects.update_or_create(book_id="science-1", defaults={"title": "علوم ۱", "subject": "علوم", "grade": 1})
        Game.objects.create(slug="g-math", title="مزرعه", book_id="math-1", grade=1, order=1, season_order=1)
        Game.objects.create(slug="g-sci", title="آزمایشگاه", book_id="science-1", grade=1, order=1, season_order=2)
        ConceptTag.objects.update_or_create(code="count", defaults={"title": "شمارش", "subject": "math"})
        ConceptTag.objects.update_or_create(code="plants", defaults={"title": "گیاهان", "subject": "science"})

    def setUp(self):
        cache.clear()

    def report(self):
        return build_child_report(self.kid)

    # ---------------------------------------------------------------- گزارشِ هفتگی
    def test_quiet_week_invites_to_play(self):
        weekly = self.report()["weekly"]
        self.assertFalse(weekly["active"])
        self.assertIn("ثبت نشده", weekly["title"])
        self.assertIn("هنوز اولین بازی‌اش", weekly["body"])      # هرگز بازی نکرده
        self.assertEqual((weekly["highlights"], weekly["cta"]), ([], "daily"))

    def test_quiet_week_after_an_old_game_mentions_it(self):
        store_events(self.kid, [answer("g-math", "count", True, ago={"days": 12})])
        weekly = self.report()["weekly"]
        self.assertFalse(weekly["active"])
        self.assertIn("آخرین بار", weekly["body"])

    def test_active_week_speaks_only_of_strengths(self):
        store_events(self.kid, [answer("g-math", "count", True) for _ in range(4)]
                     + [answer("g-math", "count", False)]
                     + [answer("g-sci", "plants", False) for _ in range(4)]          # ضعف: نباید گفته شود
                     + [{"game_slug": "g-math", "event_type": "game_complete", "session_id": "s-1",
                         "duration_ms": 600_000, "occurred_at": ms_ago(hours=1)}])
        GameCompletion.objects.create(user=self.kid, game_slug="g-math", coins_awarded=10)
        weekly = self.report()["weekly"]
        self.assertTrue(weekly["active"])
        self.assertEqual(weekly["cta"], "details")
        self.assertIn("۱ بازی را کامل کرد", weekly["body"])
        self.assertIn("۱۰ دقیقه", weekly["body"])
        self.assertIn("«ریاضی»", weekly["body"])                       # بهترین درس
        self.assertIn("«شمارش» را خیلی خوب", weekly["body"])            # بهترین مفهوم
        self.assertNotIn("علوم", weekly["body"])                        # ضعف گفته نمی‌شود
        self.assertNotIn("گیاهان", weekly["body"])
        # پاسخ‌ها «۲ ساعت پیش» و پایانِ بازی «۱ ساعت پیش» است؛ بینِ ۰۰:۰۰ و ۰۲:۰۰ دو روزِ جدا می‌شوند
        now = timezone.localtime()
        days = len({(now - timedelta(hours=2)).date(), (now - timedelta(hours=1)).date()})
        self.assertEqual([(h["key"], h["value"]) for h in weekly["highlights"]],
                         [("games", 1), ("minutes", 10), ("days", days)])

    def test_period_label_in_jalali(self):
        self.assertEqual(period_label(date(2026, 10, 6), date(2026, 10, 12)), "۱۴ تا ۲۰ مهر")
        self.assertEqual(period_label(date(2026, 9, 19), date(2026, 9, 25)), "۲۸ شهریور تا ۳ مهر")

    # ---------------------------------------------------------------- پیشنهادِ این هفته
    def test_tips_target_the_weak_concept_and_its_error_type(self):
        store_events(self.kid, [dict(answer("g-math", "count", False), error_type="careless") for _ in range(4)])
        tips = self.report()["tips"]
        self.assertEqual(tips["source"], "rules")
        first = tips["items"][0]
        self.assertEqual((first["id"], first["kind"]), ("concept:count", "practice"))
        self.assertIn("«شمارش»", first["title"])
        self.assertIn("عجله", first["body"])

    def test_tips_never_empty(self):
        items = self.report()["tips"]["items"]
        self.assertGreaterEqual(len(items), 3)
        self.assertTrue(all(item["title"] and item["body"] for item in items))

    # ---------------------------------------------------------------- قفلِ اشتراک
    def test_free_plan_shows_only_math(self):
        ends = [{"game_slug": slug, "event_type": "game_complete", "session_id": f"s-{slug}",
                 "duration_ms": 120_000, "occurred_at": ms_ago(hours=1)} for slug in ("g-math", "g-sci")]
        store_events(self.kid, [answer("g-math", "count", True) for _ in range(3)]
                     + [answer("g-sci", "plants", True) for _ in range(3)] + ends)
        report = gate_report(self.report(), premium=False)
        subjects = {s["label"]: s for s in report["subjects"]}
        self.assertFalse(subjects["ریاضی"].get("locked"))
        self.assertGreater(subjects["ریاضی"]["mastery"], 0)
        self.assertTrue(subjects["علوم"]["locked"])
        self.assertEqual((subjects["علوم"]["mastery"], subjects["علوم"]["gamesDone"], subjects["علوم"]["answers"]),
                         (0, 0, 0))                                                              # داده بیرون نمی‌رود
        self.assertEqual(subjects["ریاضی"]["answers"], 3)
        self.assertEqual([c["tag"] for c in report["learning"]["concepts"]], ["count"])
        self.assertEqual(report["learning"]["lockedConcepts"], 1)
        self.assertEqual([t["key"] for t in report["topics"]], ["count"])
        full = self.report()
        self.assertIn("علوم", {g["subjectLabel"] for g in full["games"]})
        self.assertEqual({g["subjectLabel"] for g in report["games"]}, {"ریاضی"})  # آمارِ بازیِ علوم هم نه
        self.assertEqual(report["lockedGames"], len(full["games"]) - len(report["games"]))
        self.assertIn("آزمایشگاه", {s["game"] for s in full["sessions"]})
        self.assertEqual({s["game"] for s in report["sessions"]}, {"مزرعه"})            # جلسه‌ی علوم نه
        self.assertNotIn("گیاهان", str(report["insights"]))
        tips = report["tips"]["items"]
        self.assertTrue(tips[0]["body"])
        self.assertTrue(all(t["locked"] and t["body"] == "" and t["title"] for t in tips[1:]))
        self.assertFalse(report["premium"])

    def test_free_weekly_praises_only_open_subjects(self):
        store_events(self.kid, [answer("g-sci", "plants", True) for _ in range(5)]
                     + [answer("g-math", "count", True) for _ in range(3)] + [answer("g-math", "count", False)])
        full = self.report()
        self.assertIn("«علوم»", full["weekly"]["body"])                     # با اشتراک: بهترین درس علوم
        free = gate_report(full, premium=False)["weekly"]
        self.assertNotIn("علوم", free["body"] + free["title"])               # درسِ قفل ستایش نمی‌شود
        self.assertNotIn("گیاهان", free["body"])
        self.assertIn("«ریاضی»", free["body"])
        self.assertIn("با اشتراک باز می‌شود", free["body"])
        paid = gate_report(full, premium=True)
        self.assertEqual(paid["weekly"], full["weekly"])
        self.assertFalse([k for k in paid if k.endswith("Free")])

    def test_free_tips_never_open_a_locked_subject(self):
        store_events(self.kid, [dict(answer("g-sci", "plants", False), error_type="careless") for _ in range(4)]
                     + [answer("g-math", "count", True) for _ in range(4)])
        full = self.report()
        self.assertEqual(full["tips"]["items"][0]["id"], "concept:plants")
        free = gate_report(full, premium=False)["tips"]["items"]
        self.assertNotEqual(free[0]["id"], "concept:plants")
        self.assertNotIn("گیاهان", free[0]["title"] + free[0]["body"])
        self.assertNotIn("weeklyFree", gate_report(full, premium=False))

    def test_premium_sees_everything_and_purchase_unlocks_at_once(self):
        api = APIClient()
        api.force_authenticate(self.parent)
        url = f"/api/v1/parent/children/{self.kid.id}/report"
        before = api.get(url).json()["data"]
        self.assertFalse(before["premium"])
        self.assertTrue(next(s for s in before["subjects"] if s["label"] == "علوم")["locked"])

        gift_subscription(child=self.kid, days=30, granted_by=self.admin)      # گزارش در کش است؛ قفل نه
        after = api.get(url).json()["data"]
        self.assertTrue(after["premium"])
        self.assertFalse(any(s.get("locked") for s in after["subjects"]))
        self.assertFalse(any(t.get("locked") for t in after["tips"]["items"]))
        self.assertIn("علوم", {g["subjectLabel"] for g in after["games"]})
