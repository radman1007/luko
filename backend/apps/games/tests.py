"""
مسیرِ سیزن پشتِ‌سرهم است.

پاداش سمت سرور صادر می‌شود، پس قفل هم باید همین‌جا باشد: قفلِ فقط-UI با
یک درخواستِ مستقیم به `/games/<slug>/complete` دور می‌خورد.
"""
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import Profile, User
from apps.games.models import Game, GameCompletion


class StageOrderTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create(phone="09121114001", role=User.Role.STUDENT)
        Profile.objects.get_or_create(user=cls.user)
        for i in range(1, 4):
            Game.objects.create(slug=f"seq-{i}", title=f"مرحله {i}", book_id="seq",
                                order=i, season_order=i, coin_reward=10)
        # بازیِ خارج از مسیرِ سیزن — نباید شرطی داشته باشد
        Game.objects.create(slug="free-1", title="بازیِ آزاد", book_id="free",
                            order=1, season_order=0, coin_reward=5)

    def setUp(self):
        self.api = APIClient()
        self.api.force_authenticate(self.user)

    def _complete(self, slug):
        return self.api.post(f"/api/v1/games/{slug}/complete", {}, format="json")

    def test_first_stage_is_open(self):
        self.assertEqual(self._complete("seq-1").status_code, 200)

    def test_skipping_ahead_is_rejected(self):
        res = self._complete("seq-2")
        self.assertEqual(res.status_code, 403)
        self.assertIn("مرحله", res.json()["error"]["message"])
        # هیچ سکه‌ای صادر نشده و تکمیلی ثبت نشده
        self.assertFalse(GameCompletion.objects.filter(user=self.user, game_slug="seq-2").exists())
        self.assertEqual(Profile.objects.get(user=self.user).coins, 0)

    def test_stage_opens_after_the_previous_one(self):
        self.assertEqual(self._complete("seq-1").status_code, 200)
        self.assertEqual(self._complete("seq-2").status_code, 200)
        self.assertEqual(self._complete("seq-3").status_code, 200)
        self.assertEqual(Profile.objects.get(user=self.user).coins, 30)

    def test_error_names_the_stage_to_play_first(self):
        self._complete("seq-1")
        res = self._complete("seq-3")
        self.assertEqual(res.status_code, 403)
        self.assertIn("مرحله 2", res.json()["error"]["message"])

    def test_replaying_a_done_stage_still_works(self):
        self._complete("seq-1")
        again = self._complete("seq-1")
        self.assertEqual(again.status_code, 200)
        self.assertTrue(again.json()["data"]["alreadyDone"])

    def test_games_outside_the_season_path_have_no_prerequisite(self):
        self.assertEqual(self._complete("free-1").status_code, 200)

    def test_inactive_stages_do_not_block(self):
        """مرحله‌ای که بازی‌اش هنوز نرسیده نباید جلوی بقیه را بگیرد."""
        Game.objects.filter(slug="seq-1").update(is_active=False)
        self.assertEqual(self._complete("seq-2").status_code, 200)
