"""صفحه‌ی سلامتِ پنلِ والد: حالِ کلیِ هفته (همه) و حالِ دقیقِ روزانه (فقط با اشتراک)."""
from __future__ import annotations

import uuid
from datetime import datetime, time, timedelta

from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.billing.services import gift_subscription
from apps.content.models import Podcast, PodcastListen
from apps.games.models import Book, ConceptTag, Game
from apps.games.telemetry import store_events
from apps.health.models import BreathingSession, MoodCheckin, Painting

from .gating import gate_report
from .models import ParentChild
from .services import build_child_report


def at(days_ago: int, hour: int, minute: int = 0) -> datetime:
    day = timezone.localdate() - timedelta(days=days_ago)
    return timezone.make_aware(datetime.combine(day, time(hour, minute)))


class HealthTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.kid = User.objects.create(phone="09121118001", role=User.Role.STUDENT, first_name="سارا", grade=1)
        cls.parent = User.objects.create(phone="09121118002", role=User.Role.PARENT, first_name="مریم")
        cls.admin = User.objects.create(phone="09121118003", role=User.Role.TEAM_ADMIN, is_staff=True)
        ParentChild.objects.create(parent=cls.parent, child=cls.kid)
        Book.objects.update_or_create(book_id="math-1", defaults={"title": "ریاضی ۱", "subject": "ریاضی", "grade": 1})
        Book.objects.update_or_create(book_id="science-1", defaults={"title": "علوم ۱", "subject": "علوم", "grade": 1})
        Game.objects.create(slug="h-math", title="مزرعه", book_id="math-1", grade=1, order=1, season_order=1)
        Game.objects.create(slug="h-sci", title="آزمایشگاه", book_id="science-1", grade=1, order=1, season_order=2)
        ConceptTag.objects.update_or_create(code="count", defaults={"title": "شمارش", "subject": "math"})

    def setUp(self):
        cache.clear()

    # ---------------------------------------------------------------- کمک‌ها
    def mood(self, mood: str, when: datetime):
        row = MoodCheckin.objects.create(user=self.kid, mood=mood)
        MoodCheckin.objects.filter(pk=row.pk).update(created_at=when)

    def play(self, slug: str, when: datetime, correct: bool = True, n: int = 1):
        store_events(self.kid, [{
            "game_slug": slug, "event_type": "answer", "event_id": str(uuid.uuid4()), "session_id": "s",
            "concept_tag": "count", "is_correct": correct, "attempt_number": 1, "time_taken_ms": 3000,
            "occurred_at": int((when + timedelta(seconds=10 * i)).timestamp() * 1000),
        } for i in range(n)])

    def health(self, premium: bool = True) -> dict:
        return gate_report(build_child_report(self.kid), premium)["health"]

    # ---------------------------------------------------------------- حالِ کلیِ هفته
    def test_no_checkins_invites_and_never_invents_a_mood(self):
        weekly = self.health()["weekly"]
        self.assertEqual((weekly["verdict"], weekly["mix"]), ("none", []))
        self.assertIn("ثبت نشده", weekly["title"])
        self.assertEqual(len(weekly["tips"]), 2)

    def test_great_week(self):
        for i in range(4):
            self.mood("happy", at(i, 10))
        self.mood("calm", at(1, 17))
        weekly = self.health()["weekly"]
        self.assertEqual((weekly["verdict"], weekly["label"]), ("great", "عالی"))
        self.assertIn("از ۵ باری", weekly["body"])
        self.assertEqual(weekly["mix"], [{"mood": "happy", "count": 4}, {"mood": "calm", "count": 1}])
        self.assertEqual(weekly["stats"]["checkins"], 5)
        self.assertTrue(1 <= len(weekly["tips"]) <= 2)

    def test_sad_week_needs_attention_and_suggests_talking(self):
        for i in range(3):
            self.mood("sad", at(i, 16))
        self.mood("happy", at(4, 10))
        weekly = self.health()["weekly"]
        self.assertEqual(weekly["verdict"], "attention")
        self.assertIn("«ناراحت»", weekly["title"])
        self.assertIn("w-talk", [t["id"] for t in weekly["tips"]])

    def test_trend_against_last_week(self):
        for i in range(4):
            self.mood("sad", at(8 + i, 12))
            self.mood("happy", at(i, 12))
        self.assertIn("بهتر از هفته‌ی پیش", self.health()["weekly"]["body"])

    def test_old_checkins_are_not_this_week(self):
        self.mood("happy", at(10, 9))
        weekly = self.health()["weekly"]
        self.assertEqual(weekly["verdict"], "none")
        self.assertIn("آخرین بار", weekly["body"])

    # ---------------------------------------------------------------- حالِ دقیقِ روزانه
    def test_parts_of_the_day_find_best_and_hardest(self):
        for i in range(3):
            self.mood("happy", at(i, 8))
            self.mood("tired", at(i, 22))
        daily = self.health()["daily"]
        parts = {p["key"]: p for p in daily["parts"]}
        self.assertEqual((parts["morning"]["good"], parts["morning"].get("tag")), (100, "best"))
        self.assertEqual((parts["late"]["dominant"], parts["late"].get("tag")), ("tired", "worst"))
        self.assertEqual(parts["noon"]["count"], 0)
        ids = [t["id"] for t in daily["tips"]]
        self.assertIn("d-part-late", ids)
        self.assertIn("d-best-morning", ids)

    def test_mood_after_each_subject(self):
        for i in (1, 2):                                # گذشته: زمانِ آینده را سرور «الان» می‌گیرد
            self.play("h-math", at(i, 10))
            self.mood("happy", at(i, 10, 30))           # نیم‌ساعت بعد از ریاضی
            self.play("h-sci", at(i, 16))
            self.mood("sad", at(i, 16, 40))             # بعد از علوم
        self.mood("calm", at(3, 9))                     # بی‌درس: در میانگین هست، در هیچ درسی نه
        daily = self.health()["daily"]
        subjects = {s["subject"]: s for s in daily["subjects"]}
        self.assertEqual((subjects["ریاضی"]["good"], subjects["علوم"]["good"]), (100, 0))
        self.assertGreater(subjects["ریاضی"]["lift"], 0)
        self.assertLess(subjects["علوم"]["lift"], 0)
        ids = [t["id"] for t in daily["tips"]]
        self.assertIn("d-up-ریاضی", ids)
        self.assertIn("d-down-علوم", ids)
        yesterday = daily["journey"][-2]
        self.assertEqual(yesterday["label"], "دیروز")
        self.assertEqual([(e["mood"], e["after"]) for e in yesterday["entries"]],
                         [("happy", "ریاضی"), ("sad", "علوم")])

    def test_a_game_long_before_the_checkin_is_not_the_cause(self):
        self.play("h-math", at(1, 8))
        self.mood("happy", at(1, 11))                   # سه ساعت بعد
        self.mood("happy", at(2, 11))
        daily = self.health()["daily"]
        self.assertEqual(daily["subjects"], [])
        self.assertIsNone(daily["journey"][-2]["entries"][0]["after"])

    def test_learning_with_good_and_low_mood(self):
        self.mood("happy", at(1, 10))
        self.play("h-math", at(1, 10, 5), correct=True, n=9)
        self.mood("tired", at(1, 20))
        self.play("h-math", at(1, 20, 5), correct=False, n=9)
        learning = self.health()["daily"]["learning"]
        self.assertEqual((learning["good"]["accuracy"], learning["low"]["accuracy"]), (100, 0))
        self.assertEqual(learning["good"]["answers"], 9)

    def test_too_few_answers_say_nothing_about_learning(self):
        self.mood("happy", at(1, 10))
        self.play("h-math", at(1, 10, 5), n=3)
        self.assertIsNone(self.health()["daily"]["learning"])

    def test_interests_come_with_their_numbers(self):
        for _ in range(2):
            p = Painting.objects.create(user=self.kid, colors={"#4696E5": 12, "#e5484d": 3})
            Painting.objects.filter(pk=p.pk).update(created_at=at(2, 15))
        story = Podcast.objects.create(title="قصه", category="قصه", audio_url="https://example.com/a.mp3")
        for _ in range(3):
            PodcastListen.objects.create(user=self.kid, podcast=story, seconds=120)
        for _ in range(2):
            BreathingSession.objects.create(user=self.kid, cycles=3, seconds=60)
        daily = self.health()["daily"]
        interests = {i["key"]: i for i in daily["interests"]}
        self.assertIn("آبی", interests["art"]["detail"])
        self.assertEqual(interests["theme:قصه"]["label"], "قصه‌ها")
        self.assertIn("۳ بار", interests["theme:قصه"]["detail"])
        self.assertIn("calm", interests)
        self.assertEqual(daily["favoriteColor"], {"color": "#4696e5", "label": "آبی"})

    # ---------------------------------------------------------------- قفلِ اشتراک
    def test_free_plan_gets_only_the_size_of_the_daily_analysis(self):
        for i in range(3):
            self.mood("happy", at(i, 8))
        free = self.health(premium=False)
        self.assertEqual(free["weekly"]["verdict"], "great")                  # هفتگی برای همه
        self.assertEqual(set(free["daily"]), {"locked", "teaser"})            # نه سفرِ روز، نه درس‌ها
        self.assertEqual(free["daily"]["teaser"]["checkins"], 3)
        self.assertIn("journey", self.health(premium=True)["daily"])

    def test_purchase_opens_the_daily_section_at_once(self):
        self.mood("calm", at(0, 9))
        api = APIClient()
        api.force_authenticate(self.parent)
        url = f"/api/v1/parent/children/{self.kid.id}/report"
        self.assertTrue(api.get(url).json()["data"]["health"]["daily"]["locked"])
        gift_subscription(child=self.kid, days=30, granted_by=self.admin)
        daily = api.get(url).json()["data"]["health"]["daily"]
        self.assertNotIn("locked", daily)
        self.assertEqual(len(daily["journey"]), 7)
