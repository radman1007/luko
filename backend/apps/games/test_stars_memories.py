"""ستاره‌های بازی و یادگاری‌های نقشه‌ی سیزن."""

from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import Profile, User

from .models import Game, GameCompletion, SeasonMemory
from .services import complete_game, star_map

TINY_JPEG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ=="


class StarTests(TestCase):
    def setUp(self):
        self.user = User.objects.create(phone="09121200001", role=User.Role.STUDENT)
        Profile.objects.get_or_create(user=self.user)
        for i in (1, 2):
            Game.objects.create(slug=f"s-{i}", title=f"مرحله {i}", order=i,
                                season_order=i, coin_reward=10)
        self.api = APIClient()
        self.api.force_authenticate(self.user)

    def test_completing_without_stars_stays_zero(self):
        """بازی‌های مهاجرت‌نکرده ستاره نمی‌فرستند و نباید چیزی بشکند."""
        result = complete_game(self.user, "s-1")
        self.assertEqual(result["stars"], 0)
        self.assertFalse(result["alreadyDone"])

    def test_stars_are_stored(self):
        complete_game(self.user, "s-1", stars=2)
        self.assertEqual(GameCompletion.objects.get(game_slug="s-1").stars, 2)

    def test_best_stars_are_kept_not_last(self):
        """اجرای بدترِ بعدی نباید دستاورد را پس بگیرد."""
        complete_game(self.user, "s-1", stars=3)
        result = complete_game(self.user, "s-1", stars=1)
        self.assertEqual(result["stars"], 3)
        self.assertFalse(result["starsImproved"])

    def test_replay_can_improve_stars(self):
        complete_game(self.user, "s-1", stars=1)
        result = complete_game(self.user, "s-1", stars=3)
        self.assertEqual(result["stars"], 3)
        self.assertTrue(result["starsImproved"])

    def test_stars_are_capped_at_game_max(self):
        complete_game(self.user, "s-1", stars=99)
        self.assertEqual(GameCompletion.objects.get(game_slug="s-1").stars, 3)

    def test_negative_stars_become_zero(self):
        complete_game(self.user, "s-1", stars=-4)
        self.assertEqual(GameCompletion.objects.get(game_slug="s-1").stars, 0)

    def test_star_map_lists_every_completion(self):
        complete_game(self.user, "s-1", stars=2)
        complete_game(self.user, "s-2", stars=3)
        self.assertEqual(star_map(self.user), {"s-1": 2, "s-2": 3})

    def test_endpoint_accepts_stars(self):
        res = self.api.post("/api/v1/games/s-1/complete", {"stars": 2}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["data"]["stars"], 2)

    def test_endpoint_ignores_junk_stars(self):
        """ورودیِ خراب نباید تکمیل را بشکند."""
        res = self.api.post("/api/v1/games/s-1/complete", {"stars": "خیلی"}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["data"]["stars"], 0)


class MemoryTests(TestCase):
    def setUp(self):
        self.user = User.objects.create(phone="09121200002", role=User.Role.STUDENT)
        self.other = User.objects.create(phone="09121200003", role=User.Role.STUDENT)
        self.api = APIClient()
        self.api.force_authenticate(self.user)

    def _save(self, spot="spot-1"):
        return self.api.post("/api/v1/games/memories", {
            "season_id": "season-1", "spot_id": spot,
            "thumbnail": TINY_JPEG, "image": TINY_JPEG,
        }, format="json")

    def test_saving_a_memory(self):
        res = self._save()
        self.assertEqual(res.status_code, 201)
        self.assertEqual(SeasonMemory.objects.filter(user=self.user).count(), 1)

    def test_list_carries_thumbnail_but_not_full_image(self):
        """فهرست باید سبک بماند؛ تصویرِ کامل مسیرِ خودش را دارد."""
        self._save()
        row = self.api.get("/api/v1/games/memories").json()["data"]["memories"][0]
        self.assertEqual(row["thumbnail"], TINY_JPEG)
        self.assertNotIn("image", row)

    def test_second_photo_replaces_the_first(self):
        self._save()
        self._save()
        self.assertEqual(SeasonMemory.objects.filter(user=self.user).count(), 1)

    def test_full_image_needs_the_owner(self):
        memory = SeasonMemory.objects.create(user=self.other, season_id="season-1",
                                             spot_id="spot-9", image=TINY_JPEG)
        res = self.api.get(f"/api/v1/games/memories/{memory.pk}/image")
        self.assertEqual(res.status_code, 404)

    def test_owner_gets_the_full_image(self):
        self._save()
        memory = SeasonMemory.objects.get(user=self.user)
        res = self.api.get(f"/api/v1/games/memories/{memory.pk}/image")
        self.assertEqual(res.json()["data"]["image"], TINY_JPEG)

    def test_list_is_scoped_to_the_user(self):
        SeasonMemory.objects.create(user=self.other, season_id="season-1", spot_id="spot-1")
        self._save("spot-2")
        rows = self.api.get("/api/v1/games/memories").json()["data"]["memories"]
        self.assertEqual([r["spotId"] for r in rows], ["spot-2"])

    def test_filtering_by_season(self):
        self._save()
        rows = self.api.get("/api/v1/games/memories?seasonId=season-2").json()["data"]["memories"]
        self.assertEqual(rows, [])

    def test_delete(self):
        self._save()
        memory = SeasonMemory.objects.get(user=self.user)
        self.assertEqual(self.api.delete(f"/api/v1/games/memories/{memory.pk}").status_code, 204)
        self.assertEqual(SeasonMemory.objects.count(), 0)

    def test_cannot_delete_someone_elses(self):
        memory = SeasonMemory.objects.create(user=self.other, season_id="season-1",
                                             spot_id="spot-1")
        self.api.delete(f"/api/v1/games/memories/{memory.pk}")
        self.assertTrue(SeasonMemory.objects.filter(pk=memory.pk).exists())

    def test_anonymous_is_refused(self):
        self.assertEqual(APIClient().get("/api/v1/games/memories").status_code, 401)
