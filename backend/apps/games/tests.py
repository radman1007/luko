"""
مسیرِ سیزن پشتِ‌سرهم است.

پاداش سمت سرور صادر می‌شود، پس قفل هم باید همین‌جا باشد: قفلِ فقط-UI با
یک درخواستِ مستقیم به `/games/<slug>/complete` دور می‌خورد.
"""
from django.test import TestCase, override_settings
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


@override_settings(GAME_LINK_SECRET="test-secret")
class PlayLinkTests(TestCase):
    """فایل‌های بازی فقط با لینکِ امضاشده‌ی سرور باز می‌شوند."""

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create(phone="09121114002", role=User.Role.STUDENT)
        Profile.objects.get_or_create(user=cls.user)
        for i in range(1, 4):
            Game.objects.create(slug=f"pl-{i}", title=f"مرحله {i}", book_id="pl",
                                order=i, season_order=i, coin_reward=10,
                                game_file=f"/games/grade-1/math/{i:02d}-x.html")

    def setUp(self):
        self.api = APIClient()

    def _link(self, slug):
        return self.api.get(f"/api/v1/games/{slug}/play-link")

    def test_first_stage_is_open_without_an_account(self):
        """مهمان فقط مرحله‌ی اول را می‌گیرد — همان چیزی که برای امتحانِ اپ لازم است."""
        res = self._link("pl-1")
        self.assertEqual(res.status_code, 200)
        self.assertIn("?e=", res.json()["data"]["url"])

    def test_other_stages_need_an_account(self):
        self.assertEqual(self._link("pl-2").status_code, 401)

    def test_locked_stage_gives_no_link(self):
        """حتی حسابِ واقعی هم نمی‌تواند یک‌جا همه را بردارد."""
        self.api.force_authenticate(self.user)
        self.assertEqual(self._link("pl-3").status_code, 403)

    def test_unlocked_stage_gives_a_link(self):
        GameCompletion.objects.create(user=self.user, game_slug="pl-1")
        self.api.force_authenticate(self.user)
        res = self._link("pl-2")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json()["data"]["url"].startswith("/games/grade-1/math/02-x.html?"))

    def test_signature_matches_what_nginx_computes(self):
        """امضا باید دقیقاً قالبِ secure_linkِ nginx باشد، وگرنه همه‌چیز ۴۰۳ می‌شود."""
        import base64, hashlib
        from urllib.parse import parse_qs, urlparse
        from apps.games.playlink import sign

        path = "/games/grade-1/math/01-x.html"
        url = sign(path)
        query = parse_qs(urlparse(url).query)
        expires, token = query["e"][0], query["k"][0]

        expected = base64.urlsafe_b64encode(
            hashlib.md5(f"{expires}{path}test-secret".encode()).digest()
        ).decode().rstrip("=")
        self.assertEqual(token, expected)
        self.assertNotIn("=", token)      # nginx پرکننده‌ی base64 را نمی‌پذیرد

    def test_link_expires(self):
        from urllib.parse import parse_qs, urlparse
        from apps.games.playlink import sign
        import time
        url = sign("/games/x.html", ttl=120)
        expires = int(parse_qs(urlparse(url).query)["e"][0])
        self.assertGreater(expires, int(time.time()))
        self.assertLessEqual(expires, int(time.time()) + 120)

    def test_missing_game_is_404(self):
        self.api.force_authenticate(self.user)
        self.assertEqual(self._link("nope").status_code, 404)


class CatalogCacheTests(TestCase):
    """کاتالوگ کش می‌شود ولی ویرایشِ ادمین باید فوراً دیده شود."""

    def setUp(self):
        from django.core.cache import cache as django_cache
        django_cache.clear()
        self.user = User.objects.create(phone="09121118001", role=User.Role.STUDENT)
        Profile.objects.get_or_create(user=self.user)
        self.api = APIClient()
        self.api.force_authenticate(self.user)

    def test_editing_a_game_shows_up_immediately(self):
        from apps.games.models import Book
        Book.objects.create(book_id="cache-1", title="قدیمی", subject="ریاضی", grade=1)
        first = self.api.get("/api/v1/books").json()["data"]["books"]
        self.assertIn("قدیمی", [b["title"] for b in first])

        Book.objects.filter(book_id="cache-1").update(title="تازه")
        # update() سیگنال نمی‌زند، پس عمداً با save تست می‌کنیم — همان کاری که ادمین می‌کند
        book = Book.objects.get(book_id="cache-1")
        book.title = "تازه"
        book.save()

        second = self.api.get("/api/v1/books").json()["data"]["books"]
        self.assertIn("تازه", [b["title"] for b in second])

    def test_completed_endpoint_is_light(self):
        """
        نقشه‌ی سیزن فقط همین را می‌خواهد، نه کلِ کاتالوگ.

        `completed` عمداً همان آرایه‌ی رشته مانده — کارت‌های خانه و نقشه
        رویش بسته‌اند. ستاره‌ها کنارش آمده‌اند، نه به‌جایش.
        """
        GameCompletion.objects.create(user=self.user, game_slug="x-1", stars=2)
        res = self.api.get("/api/v1/games/completed")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["data"],
                         {"completed": ["x-1"], "stars": {"x-1": 2}})
