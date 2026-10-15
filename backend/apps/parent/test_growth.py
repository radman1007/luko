"""رشدِ چهار هفته (صفحه‌ی دستیار): پیشرفت در کتاب، تمرکز، حالِ خوب، قفلِ پلنِ رایگان و تحلیلِ هوشمند."""
from __future__ import annotations

import uuid
from datetime import datetime, time, timedelta

from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.ai.facts import build_facts
from apps.ai.insights import merge
from apps.ai.models import AIInsight
from apps.ai.prompts import insight_sections
from apps.ai.validate import validate_bundle
from apps.billing.services import gift_subscription
from apps.games.models import Book, Game, GameCompletion, GameEvent
from apps.health.models import MoodCheckin

from .gating import gate_report
from .models import ParentChild
from .services import build_child_report


def at(days_ago: int, hour: int = 17) -> datetime:
    day = timezone.localdate() - timedelta(days=days_ago)
    return timezone.make_aware(datetime.combine(day, time(hour, 0)))


def dim(growth: dict, key: str) -> dict:
    return next(d for d in growth["dims"] if d["key"] == key)


class GrowthTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.kid = User.objects.create(phone="09121119001", role=User.Role.STUDENT, first_name="نیما", grade=1)
        cls.parent = User.objects.create(phone="09121119002", role=User.Role.PARENT, first_name="لیلا")
        cls.admin = User.objects.create(phone="09121119003", role=User.Role.TEAM_ADMIN, is_staff=True)
        ParentChild.objects.create(parent=cls.parent, child=cls.kid)
        for book_id, subject in (("math-1", "ریاضی"), ("farsi-1", "فارسی"), ("writing-1", "نگارش")):
            Book.objects.update_or_create(book_id=book_id, defaults={"title": book_id, "subject": subject, "grade": 1})
        for index in range(4):
            Game.objects.create(slug=f"g-math-{index}", title=f"ریاضی {index}", book_id="math-1", grade=1,
                                order=index, season_order=index)
        Game.objects.create(slug="g-farsi", title="الفبا", book_id="farsi-1", grade=1, order=1, season_order=10)
        Game.objects.create(slug="g-write", title="نوشتن", book_id="writing-1", grade=1, order=1, season_order=11)
        # بازیِ کلاسِ دیگر در «از چند بازی» شمرده نمی‌شود
        Game.objects.create(slug="g-math-g2", title="ریاضی دوم", book_id="math-1", grade=2, order=9, season_order=20)

        # ریاضی: یکی ۲۵ روز پیش، دو تا ۱۰ روز پیش، یکی امروز (هر بازی یک ردیف دارد، تکرار ردیف نمی‌سازد)
        for slug, days in (("g-math-0", 25), ("g-math-1", 10), ("g-math-2", 10), ("g-math-3", 0)):
            row = GameCompletion.objects.create(user=cls.kid, game_slug=slug, coins_awarded=10)
            GameCompletion.objects.filter(pk=row.pk).update(created_at=at(days))

        # تمرکز در هفته‌ی آخر: ۳ بازیِ تمام‌شده + ۱ نیمه‌کاره، ۹ دقیقه فعال و ۱ دقیقه بی‌حرکت
        def session(days, done, minutes):
            sid = uuid.uuid4().hex[:10]
            GameEvent.objects.create(
                user=cls.kid, game_slug="g-math-3", event_type="game_complete" if done else "game_end",
                session_id=sid, occurred_at=at(days), duration_ms=minutes * 60000,
                payload={"completed": done} if done else {"abandoned": True})
        for minutes in (3, 3, 2):
            session(1, True, minutes)
        session(2, False, 1)
        GameEvent.objects.create(user=cls.kid, game_slug="g-math-3", event_type="idle", occurred_at=at(1),
                                 payload={"ms": 60000})
        # هفته‌ی دوم فقط دو جلسه: «داده‌ی کافی نیست»، نه صفر
        session(15, True, 4)
        session(16, True, 4)

        # حال: هفته‌ی آخر ۳ ثبت (۲ خوب)، هفته‌ی اول یک ثبت (کمتر از حداقل)
        for mood, days in (("happy", 1), ("calm", 2), ("sad", 3), ("tired", 26)):
            row = MoodCheckin.objects.create(user=cls.kid, mood=mood)
            MoodCheckin.objects.filter(pk=row.pk).update(created_at=at(days))

    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.client.force_authenticate(self.parent)

    def growth(self, premium: bool) -> dict:
        return gate_report(build_child_report(self.kid), premium)["growth"]

    def test_book_progress_is_cumulative_for_this_grade_only(self):
        math = dim(self.growth(True), "math")
        self.assertEqual(math["points"], [25, 25, 75, 100])
        self.assertEqual(math["detail"]["total"], 4)
        self.assertEqual(math["detail"]["done"], 4)
        self.assertEqual(math["detail"]["newThisMonth"], 4)
        self.assertEqual((math["now"], math["change"]), (100, 75))

    def test_subject_without_any_finished_game_is_not_started(self):
        language = dim(self.growth(True), "language")
        self.assertEqual(language["status"], "empty")
        self.assertEqual(language["points"], [0, 0, 0, 0])
        self.assertEqual(language["detail"]["total"], 2)

    def test_focus_needs_enough_sessions_and_counts_idle_time(self):
        focus = dim(self.growth(True), "focus")
        # هفته‌ی آخر: ۳ از ۴ تمام × (۹ از ۱۰ دقیقه فعال) = ۶۸٪؛ هفته‌ی دوم دو جلسه دارد → بی‌داده
        self.assertEqual(focus["points"], [None, None, None, 68])
        self.assertEqual(focus["detail"]["abandoned"], 1)
        self.assertIsNone(focus["change"])

    def test_mood_is_good_share_of_each_week(self):
        mood = dim(self.growth(True), "mood")
        self.assertEqual(mood["points"], [None, None, None, 67])
        self.assertEqual(mood["detail"]["checkins"], [1, 0, 0, 3])

    def test_free_plan_locks_language_and_mood_without_data(self):
        growth = self.growth(False)
        for key in ("language", "mood"):
            locked = dim(growth, key)
            self.assertTrue(locked["locked"])
            self.assertEqual(locked["points"], [None] * 4)
            self.assertEqual(locked["detail"], {})
        self.assertEqual(dim(growth, "math")["points"], [25, 25, 75, 100])
        self.assertEqual(growth["lockedDims"], 2)
        texts = " ".join(filter(None, [growth["summary"], *(c and c["body"] for c in
                                                             (growth["strength"], growth["attention"]))]))
        self.assertNotIn("زبانی", texts)

    def test_rule_texts_cite_real_numbers(self):
        growth = self.growth(True)
        self.assertIn("۴ بازیِ تازه", growth["summary"])
        self.assertIn("در ریاضی از ۲۵٪ به ۱۰۰٪", growth["summary"])
        self.assertIn("هر چهار هفته فعال بود", growth["summary"])
        self.assertEqual(growth["strength"]["title"], "پیشرفت در ریاضی")
        self.assertEqual(growth["weeks"][3]["label"], "هفته‌ی ۴")

    def test_report_api_sends_the_gated_growth(self):
        response = self.client.get(f"/api/v1/parent/children/{self.kid.id}/report")
        self.assertEqual(response.status_code, 200)
        growth = response.json()["data"]["growth"]
        self.assertTrue(next(d for d in growth["dims"] if d["key"] == "language")["locked"])
        gift_subscription(child=self.kid, days=10, granted_by=self.admin)
        cache.clear()
        growth = self.client.get(f"/api/v1/parent/children/{self.kid.id}/report").json()["data"]["growth"]
        self.assertFalse(any(d.get("locked") for d in growth["dims"]))

    # ---------------------------------------------------------------- تحلیلِ هوشمند
    def test_facts_carry_only_open_dimensions(self):
        free = build_facts(gate_report(build_child_report(self.kid), False), premium=False)
        names = [d["name"] for d in free["last_4_weeks"]["dimensions"]]
        self.assertEqual(names, ["ریاضی", "تمرکز و توجه"])
        full = build_facts(gate_report(build_child_report(self.kid), True), premium=True)
        language = next(d for d in full["last_4_weeks"]["dimensions"] if d["name"] == "مهارت‌های زبانی")
        self.assertIs(language["started"], False)
        self.assertNotIn("games_completed_so_far", language)
        self.assertIn("month", insight_sections(full))

    def test_month_section_rejects_invented_numbers_and_locked_dimension(self):
        facts = build_facts(gate_report(build_child_report(self.kid), False), premium=False)
        good = {"month": {
            "summary": "[نام] در این چهار هفته ۴ بازیِ تازه‌ی ریاضی را تمام کرد و پیشرفتش به ۱۰۰٪ رسید.",
            "strength": {"title": "پیشرفت در ریاضی", "body": "پیشرفت در کتابِ ریاضی از ۲۵٪ به ۱۰۰٪ رسید؛ عالی است."},
            "attention": {"title": "تمرکز", "body": "تمرکز این هفته ۶۸٪ بود و یک بازی نیمه‌کاره ماند."},
            "next_step": {"title": "بازیِ کوتاهِ عصر", "body": "روزی ۱۰ دقیقه در عصر با هم یک بازیِ ریاضی کنید."},
        }}
        accepted, rejected = validate_bundle(good, facts, ["month"])
        self.assertEqual(rejected, {})
        self.assertEqual(accepted["month"]["strength"]["title"], "پیشرفت در ریاضی")

        bad = {"month": {**good["month"], "summary": "[نام] در این ماه ۸۷٪ پیشرفت داشت و همه‌چیز خوب بود."}}
        self.assertIn("month", validate_bundle(bad, facts, ["month"])[1])
        leak = {"month": {**good["month"], "attention": {"title": "مهارت‌های زبانی",
                                                          "body": "در مهارت‌های زبانی هنوز شروع نکرده است و مهم است."}}}
        self.assertIsNone(validate_bundle(leak, facts, ["month"])[0]["month"]["attention"])

    def test_merge_swaps_texts_but_keeps_numbers(self):
        report = gate_report(build_child_report(self.kid), True)
        insight = AIInsight(child=self.kid, variant=AIInsight.Variant.FULL, tier="flash", fingerprint="x", payload={
            "month": {"summary": "[نام] این ماه خوب پیش رفت و پیشرفتش در ریاضی به ۱۰۰٪ رسید.",
                      "strength": {"title": "ریاضی", "body": "پیشرفت از ۲۵٪ به ۱۰۰٪ رسید."},
                      "attention": None,
                      "next_step": {"title": "عصرها", "body": "روزی ۱۰ دقیقه بازیِ ریاضی."}}})
        out = merge(report, insight, name="نیما", premium=True)["growth"]
        self.assertEqual(out["source"], "ai")
        self.assertTrue(out["summary"].startswith("نیما "))
        self.assertEqual(out["attention"], report["growth"]["attention"])  # ردشده → قاعده‌محور
        self.assertEqual(out["next"]["link"], "daily")
        self.assertEqual(out["strength"]["link"], "details")
        self.assertEqual(dim(out, "math")["points"], [25, 25, 75, 100])
