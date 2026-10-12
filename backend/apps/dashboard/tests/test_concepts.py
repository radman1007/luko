"""داشبورد ← تگ‌های آموزشی: تعریف، ویرایش، حذف، و کدهای ثبت‌نشده‌ای که بازی‌ها فرستاده‌اند."""
from apps.accounts.models import User
from apps.dashboard.models import AuditLog
from apps.games.models import ConceptTag, Game, GameEvent

from .base import DashboardTestBase


class ConceptTests(DashboardTestBase):
    def setUp(self):
        super().setUp()
        self.designer = self.make_staff("09120007001", ["concepts"], title="تیمِ طراحی")
        self.sign_in(self.designer)
        self.kid = User.objects.create_user("09120007002", role="student")

    def answer(self, tag, correct, slug="g-1"):
        GameEvent.objects.create(user=self.kid, game_slug=slug, event_type="answer",
                                 concept_tag=tag, is_correct=correct, payload={})

    def test_designer_defines_a_tag(self):
        res = self.post("concepts", {"code": "Addition_3digit", "title": "جمعِ سه رقمی", "subject": "math",
                                     "grade": 3, "description": "جمعِ دو عددِ سه رقمی با انتقال"})
        self.assertEqual(res.status_code, 201, res.content)
        tag = ConceptTag.objects.get(code="addition_3digit")               # حروفِ کوچک
        self.assertEqual((tag.title, tag.grade, tag.is_active), ("جمعِ سه رقمی", 3, True))
        self.assertEqual(self.data(res)["subjectLabel"], "ریاضی")
        self.assertTrue(AuditLog.objects.filter(action="concept_create", actor=self.designer).exists())

    def test_bad_codes_are_refused(self):
        for code in ("جمع", "has space", "2digit", ""):
            res = self.post("concepts", {"code": code, "title": "x"})
            self.assertEqual(res.status_code, 400, code)
        ConceptTag.objects.create(code="dup_tag", title="یک")
        self.assertEqual(self.post("concepts", {"code": "dup_tag", "title": "دو"}).status_code, 400)
        self.assertEqual(self.post("concepts", {"code": "ok_tag", "title": "x", "subject": "chemistry"}).status_code, 400)

    def test_list_shows_usage_and_filters(self):
        ConceptTag.objects.create(code="sub_tag", title="تفریقِ ده‌تایی", subject="math", grade=1)
        ConceptTag.objects.create(code="quran_tag", title="قرآن", subject="quran", grade=1, is_active=False)
        self.answer("sub_tag", False)
        self.answer("sub_tag", True, slug="g-2")
        rows = {r["code"]: r for r in self.data(self.get("concepts"))["results"]}
        self.assertEqual((rows["sub_tag"]["answers"], rows["sub_tag"]["errors"], rows["sub_tag"]["games"]), (2, 1, 2))
        only_math = self.data(self.get("concepts", subject="math", active="true"))["results"]
        self.assertNotIn("quran_tag", [r["code"] for r in only_math])
        found = self.data(self.get("concepts", q="ده‌تایی"))["results"]
        self.assertEqual([r["code"] for r in found], ["sub_tag"])

    def test_used_code_cannot_be_renamed_or_deleted(self):
        tag = ConceptTag.objects.create(code="used_tag", title="قدیم")
        self.answer("used_tag", True)
        self.assertEqual(self.patch(f"concepts/{tag.pk}", {"code": "new_tag"}).status_code, 400)
        self.assertEqual(self.delete(f"concepts/{tag.pk}").status_code, 409)
        # عنوان و غیرفعال‌کردن آزاد است
        res = self.patch(f"concepts/{tag.pk}", {"title": "تازه", "isActive": False})
        self.assertEqual(res.status_code, 200, res.content)
        tag.refresh_from_db()
        self.assertEqual((tag.title, tag.is_active, tag.code), ("تازه", False, "used_tag"))

    def test_unused_tag_can_be_deleted(self):
        tag = ConceptTag.objects.create(code="typo_tag", title="غلط")
        self.assertEqual(self.delete(f"concepts/{tag.pk}").status_code, 200)
        self.assertFalse(ConceptTag.objects.filter(pk=tag.pk).exists())

    def test_unknown_codes_sent_by_games_are_listed(self):
        Game.objects.create(slug="g-typo", title="مزرعه‌ی جمع", book_id="b")
        ConceptTag.objects.create(code="known_tag", title="ثبت‌شده")
        self.answer("known_tag", True)
        self.answer("adition_2digit", False, slug="g-typo")              # غلطِ املایی در کدِ بازی
        self.answer("adition_2digit", True, slug="g-typo")
        rows = self.data(self.get("concepts/unknown"))["results"]
        self.assertEqual([(r["code"], r["count"], r["exampleGame"]) for r in rows],
                         [("adition_2digit", 2, "مزرعه‌ی جمع")])

    def test_meta_offers_subjects(self):
        subjects = self.data(self.get("meta"))["conceptSubjects"]
        self.assertIn({"value": "math", "label": "ریاضی"}, subjects)
