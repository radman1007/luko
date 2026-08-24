"""
تست‌های پنل والدین: دسترسی (فقط فرزندِ خودش) و درستیِ محاسبه‌های گزارش.

    USE_SQLITE=1 python manage.py test apps.parent
"""
from django.test import TestCase
from rest_framework.test import APIClient
from datetime import timedelta

from django.utils import timezone

from django.core.cache import cache

from apps.accounts.models import Profile, User
from apps.games.models import Book, Game, GameCompletion, GameEvent
from apps.health.models import BreathingSession, MoodCheckin

from .models import DailyAssignment, ParentChild
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
            {"childId", "answersThisWeek", "kpis", "week", "accuracyTrend", "subjects",
             "games", "moods", "insights", "wellbeing", "hourly", "sessions", "topics"},
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

    def test_hourly_has_24_buckets_and_marks_activity(self):
        hourly = build_child_report(self.child)["hourly"]
        self.assertEqual(len(hourly), 24)
        self.assertTrue(any(bucket["count"] > 0 for bucket in hourly))
        self.assertEqual(max(bucket["intensity"] for bucket in hourly), 100)

    def test_sessions_list_last_plays(self):
        sessions = build_child_report(self.child)["sessions"]
        self.assertEqual(len(sessions), 1)
        self.assertEqual(sessions[0]["minutes"], 5)
        self.assertEqual(sessions[0]["accuracy"], 67)

    def test_topics_breakdown_sorted_by_accuracy(self):
        topics = build_child_report(self.child)["topics"]
        labels = [t["label"] for t in topics]
        self.assertEqual(labels, ["ترتیب اعداد", "شمارش"])
        self.assertEqual(topics[0]["accuracy"], 100)
        self.assertEqual(topics[-1]["accuracy"], 0)

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


class AssignmentTests(TestCase):
    """«بازی روز»ی که والد برای فرزندش می‌گذارد."""

    @classmethod
    def setUpTestData(cls):
        cls.parent = User.objects.create(phone="09140000001", role=User.Role.PARENT)
        cls.stranger = User.objects.create(phone="09140000002", role=User.Role.PARENT)
        cls.child = User.objects.create(phone="09140000003", role=User.Role.STUDENT)
        ParentChild.objects.create(parent=cls.parent, child=cls.child)
        Book.objects.create(book_id="math-1", title="ریاضی اول", subject="ریاضی", grade=1)
        Game.objects.create(slug="math-1-1", title="قطار اعداد", book_id="math-1", order=1)

    def setUp(self):
        self.api = APIClient()
        self.api.force_authenticate(self.parent)
        self.url = f"/api/v1/parent/children/{self.child.id}/assignments"
        self.today = timezone.localdate().isoformat()

    def test_parent_sets_game_of_the_day(self):
        response = self.api.post(self.url, {"gameSlug": "math-1-1", "date": self.today,
                                            "note": "بعد از مشق"}, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["data"]["gameTitle"], "قطار اعداد")

    def test_same_day_twice_replaces_instead_of_duplicating(self):
        self.api.post(self.url, {"gameSlug": "math-1-1", "date": self.today}, format="json")
        second = self.api.post(self.url, {"gameSlug": "math-1-1", "date": self.today,
                                          "note": "عوض شد"}, format="json")
        self.assertEqual(second.status_code, 200)
        self.assertEqual(DailyAssignment.objects.filter(child=self.child).count(), 1)

    def test_unknown_game_is_rejected(self):
        response = self.api.post(self.url, {"gameSlug": "not-a-game", "date": self.today},
                                 format="json")
        self.assertEqual(response.status_code, 400)

    def test_past_date_is_rejected(self):
        yesterday = (timezone.localdate() - timedelta(days=1)).isoformat()
        response = self.api.post(self.url, {"gameSlug": "math-1-1", "date": yesterday},
                                 format="json")
        self.assertEqual(response.status_code, 400)

    def test_stranger_cannot_assign(self):
        self.api.force_authenticate(self.stranger)
        response = self.api.post(self.url, {"gameSlug": "math-1-1", "date": self.today},
                                 format="json")
        self.assertEqual(response.status_code, 404)

    def test_child_sees_todays_assignment(self):
        self.api.post(self.url, {"gameSlug": "math-1-1", "date": self.today}, format="json")
        kid = APIClient()
        kid.force_authenticate(self.child)
        response = kid.get("/api/v1/my/assignment")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["data"]["assignment"]["gameSlug"], "math-1-1")


class PreferenceTests(TestCase):
    def setUp(self):
        self.parent = User.objects.create(phone="09121110011", role=User.Role.PARENT)
        self.client = APIClient()
        self.client.force_authenticate(self.parent)

    def test_defaults_are_on(self):
        response = self.client.get("/api/v1/parent/preferences")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["data"]["weeklyReport"])
        self.assertTrue(response.json()["data"]["activityAlerts"])

    def test_patch_toggles_and_persists(self):
        self.client.patch("/api/v1/parent/preferences", {"weeklyReport": False}, format="json")
        response = self.client.get("/api/v1/parent/preferences")
        self.assertFalse(response.json()["data"]["weeklyReport"])
        self.assertTrue(response.json()["data"]["activityAlerts"])


class NotificationTests(TestCase):
    def setUp(self):
        cache.clear()          # گاردِ throttle نباید از تستِ قبلی بماند
        self.parent = User.objects.create(phone="09121110012", role=User.Role.PARENT)
        self.child = User.objects.create(phone="09121110013", role=User.Role.STUDENT,
                                         first_name="آرش")
        ParentChild.objects.create(parent=self.parent, child=self.child, grade=1)
        Game.objects.get_or_create(slug="math-1-1", defaults={"title": "بازی یک",
                                                              "book_id": "math-1", "order": 1})
        self.client = APIClient()
        self.client.force_authenticate(self.parent)

    def test_activity_builds_notifications(self):
        GameEvent.objects.create(user=self.child, game_slug="math-1-1", event_type="answer",
                                 payload={"correct": True})
        GameCompletion.objects.create(user=self.child, game_slug="math-1-1", coins_awarded=10)

        response = self.client.get("/api/v1/parent/notifications")
        data = response.json()["data"]
        kinds = {row["kind"] for row in data["items"]}
        self.assertIn("weekly", kinds)
        self.assertIn("games", kinds)
        self.assertEqual(data["unread"], len(data["items"]))

    def test_each_game_gets_one_notification_only(self):
        # هر بازی برای هر بچه فقط یک‌بار تکمیل می‌شود، پس سه بازیِ متفاوت
        for slug in ("math-1-1", "math-1-2", "math-1-3"):
            Game.objects.get_or_create(slug=slug, defaults={"title": slug, "book_id": "math-1"})
            GameCompletion.objects.create(user=self.child, game_slug=slug, coins_awarded=10)

        first = self.client.get("/api/v1/parent/notifications").json()["data"]["items"]
        second = self.client.get("/api/v1/parent/notifications").json()["data"]["items"]
        game_rows = [row for row in second if row["kind"] == "games"]

        self.assertEqual(len(first), len(second))          # همگام‌سازی دوباره چیزی اضافه نمی‌کند
        self.assertEqual(len(game_rows), 3)                # سه تکمیل → سه اعلان، نه بیشتر

    def test_sync_is_idempotent(self):
        GameEvent.objects.create(user=self.child, game_slug="math-1-1", event_type="answer",
                                 payload={"correct": True})
        first = self.client.get("/api/v1/parent/notifications").json()["data"]["items"]
        second = self.client.get("/api/v1/parent/notifications").json()["data"]["items"]
        self.assertEqual(len(first), len(second))

    def test_weekly_off_hides_weekly_notification(self):
        GameEvent.objects.create(user=self.child, game_slug="math-1-1", event_type="answer",
                                 payload={"correct": True})
        self.client.patch("/api/v1/parent/preferences", {"weeklyReport": False}, format="json")
        items = self.client.get("/api/v1/parent/notifications").json()["data"]["items"]
        self.assertNotIn("weekly", {row["kind"] for row in items})

    def test_mark_all_read(self):
        GameEvent.objects.create(user=self.child, game_slug="math-1-1", event_type="answer",
                                 payload={"correct": True})
        self.client.get("/api/v1/parent/notifications")
        self.client.post("/api/v1/parent/notifications/read")
        data = self.client.get("/api/v1/parent/notifications").json()["data"]
        self.assertEqual(data["unread"], 0)

    def test_idle_child_gets_a_nudge(self):
        old = timezone.now() - timedelta(days=5)
        event = GameEvent.objects.create(user=self.child, game_slug="math-1-1",
                                         event_type="answer", payload={"correct": True})
        GameEvent.objects.filter(pk=event.pk).update(created_at=old)

        items = self.client.get("/api/v1/parent/notifications").json()["data"]["items"]
        self.assertIn("idle", {row["kind"] for row in items})


class SuggestionTests(TestCase):
    def setUp(self):
        self.parent = User.objects.create(phone="09121110014", role=User.Role.PARENT)
        self.child = User.objects.create(phone="09121110015", role=User.Role.STUDENT)
        ParentChild.objects.create(parent=self.parent, child=self.child, grade=1)
        Book.objects.get_or_create(book_id="math-1", defaults={"title": "ریاضی اول",
                                                               "subject": "ریاضی", "grade": 1})
        Game.objects.get_or_create(slug="g-weak", defaults={"title": "بازی الگو",
                                                            "book_id": "math-1", "order": 1})
        Game.objects.get_or_create(slug="g-new", defaults={"title": "بازی تازه",
                                                           "book_id": "math-1", "order": 2})
        self.client = APIClient()
        self.client.force_authenticate(self.parent)

    def test_weakest_topic_game_is_recommended(self):
        # مبحثِ «pattern» با دقتِ پایین و بیش از ۱۰ پاسخ
        for i in range(12):
            GameEvent.objects.create(user=self.child, game_slug="g-weak", event_type="answer",
                                     payload={"topic": "pattern", "correct": i % 4 == 0})
        for i in range(12):
            GameEvent.objects.create(user=self.child, game_slug="g-new", event_type="answer",
                                     payload={"topic": "count", "correct": True})

        data = self.client.get(f"/api/v1/parent/children/{self.child.id}/suggestions").json()["data"]
        self.assertTrue(data["suggestions"])
        top = data["suggestions"][0]
        self.assertEqual(top["slug"], "g-weak")
        self.assertTrue(top["recommended"])
        self.assertIn("الگو", top["why"])

    def test_other_parents_child_is_forbidden(self):
        stranger = User.objects.create(phone="09121110016", role=User.Role.PARENT)
        self.client.force_authenticate(stranger)
        response = self.client.get(f"/api/v1/parent/children/{self.child.id}/suggestions")
        self.assertEqual(response.status_code, 404)


class ParentChildLoopTests(TestCase):
    """
    حلقه‌ی کاملِ پنل والدین ↔ پنل دانش‌آموز:
    والد بازی روز می‌گذارد → بچه آن را می‌بیند → بازی می‌کند →
    گزارشِ والد همان لحظه (نه بعد از TTL) تازه می‌شود.
    """

    def setUp(self):
        cache.clear()
        self.parent = User.objects.create(phone="09121110021", role=User.Role.PARENT)
        self.child = User.objects.create(phone="09121110022", role=User.Role.STUDENT,
                                         first_name="آرش")
        Profile.objects.get_or_create(user=self.child)
        ParentChild.objects.create(parent=self.parent, child=self.child, grade=1)
        Book.objects.get_or_create(book_id="math-1", defaults={"title": "ریاضی اول",
                                                               "subject": "ریاضی", "grade": 1})
        Game.objects.get_or_create(slug="math-1-1", defaults={"title": "جزیره‌ی حیوانات",
                                                              "book_id": "math-1", "order": 1,
                                                              "coin_reward": 10})
        self.parent_client = APIClient()
        self.parent_client.force_authenticate(self.parent)
        self.child_client = APIClient()
        self.child_client.force_authenticate(self.child)

    def test_assignment_reaches_the_child(self):
        today = timezone.localdate().isoformat()
        response = self.parent_client.post(
            f"/api/v1/parent/children/{self.child.id}/assignments",
            {"gameSlug": "math-1-1", "date": today, "note": "این را امروز بزن"},
            format="json",
        )
        self.assertIn(response.status_code, (200, 201))

        mine = self.child_client.get("/api/v1/my/assignment").json()["data"]["assignment"]
        self.assertEqual(mine["gameSlug"], "math-1-1")
        self.assertEqual(mine["note"], "این را امروز بزن")
        self.assertFalse(mine["played"])

    def test_child_activity_shows_up_in_parent_report_immediately(self):
        # گزارشِ اول: خالی — و همین کش می‌شود
        before = self.parent_client.get(
            f"/api/v1/parent/children/{self.child.id}/report").json()["data"]
        self.assertEqual(before["answersThisWeek"], 0)

        # بچه بازی می‌کند: رویدادها + تکمیل
        events = [
            {"gameSlug": "math-1-1", "eventType": "answer",
             "payload": {"topic": "count", "correct": True, "ms": 3000}},
            {"gameSlug": "math-1-1", "eventType": "game_end",
             "payload": {"durationMs": 300000, "accuracy": 100}},
        ]
        self.assertEqual(
            self.child_client.post("/api/v1/games/events", events, format="json").status_code, 200
        )
        self.child_client.post("/api/v1/games/math-1-1/complete")

        # گزارشِ والد باید همان لحظه تازه باشد (کش صریحاً باطل شده)
        after = self.parent_client.get(
            f"/api/v1/parent/children/{self.child.id}/report").json()["data"]
        self.assertEqual(after["answersThisWeek"], 1)
        self.assertEqual(after["kpis"][1]["value"], 1)          # بازی کامل‌شده
        self.assertEqual(after["kpis"][0]["value"], 5)          # ۵ دقیقه

    def test_playing_the_assigned_game_marks_it_played(self):
        today = timezone.localdate().isoformat()
        self.parent_client.post(
            f"/api/v1/parent/children/{self.child.id}/assignments",
            {"gameSlug": "math-1-1", "date": today}, format="json",
        )
        self.child_client.post("/api/v1/games/math-1-1/complete")

        mine = self.child_client.get("/api/v1/my/assignment").json()["data"]["assignment"]
        self.assertTrue(mine["played"])

    def test_parent_cannot_reach_a_child_that_is_not_theirs(self):
        stranger = User.objects.create(phone="09121110023", role=User.Role.PARENT)
        client = APIClient()
        client.force_authenticate(stranger)
        for url in (
            f"/api/v1/parent/children/{self.child.id}/report",
            f"/api/v1/parent/children/{self.child.id}/assignments",
            f"/api/v1/parent/children/{self.child.id}/suggestions",
        ):
            self.assertEqual(client.get(url).status_code, 404, url)
