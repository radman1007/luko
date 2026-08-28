"""گالریِ نقاشی‌ها — نگه‌داشتن، دیدن و حذف."""
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.health.models import Painting

PNG = "data:image/png;base64," + "A" * 200
THUMB = "data:image/jpeg;base64," + "B" * 100


class PaintingGalleryTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.kid = User.objects.create(phone="09121115001", role=User.Role.STUDENT)
        cls.other = User.objects.create(phone="09121115002", role=User.Role.STUDENT)

    def setUp(self):
        self.api = APIClient()
        self.api.force_authenticate(self.kid)

    def _save(self, **extra):
        body = {"thumbnail": THUMB, "image": PNG, "mood": "happy",
                "colors": {"#f00": 3}, **extra}
        return self.api.post("/api/v1/paintings", body, format="json")

    def test_saving_a_painting(self):
        res = self._save(title="خونه‌ی ما")
        self.assertEqual(res.status_code, 201)
        painting = Painting.objects.get(user=self.kid)
        self.assertEqual(painting.image, PNG)
        self.assertEqual(painting.title, "خونه‌ی ما")

    def test_list_is_light_and_has_a_persian_date(self):
        """تصویرِ کامل نباید در فهرست بیاید، وگرنه گالری با چند ده نقاشی سنگین می‌شود."""
        self._save()
        row = self.api.get("/api/v1/paintings").json()["data"][0]
        self.assertNotIn("image", row)
        self.assertIn("thumbnail", row)
        self.assertTrue(row["when"])

    def test_opening_a_painting_returns_the_full_image(self):
        pk = self._save().json()["data"]["id"]
        res = self.api.get(f"/api/v1/paintings/{pk}/image")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["data"]["image"], PNG)

    def test_deleting_a_painting(self):
        pk = self._save().json()["data"]["id"]
        self.assertEqual(self.api.delete(f"/api/v1/paintings/{pk}").status_code, 204)
        self.assertFalse(Painting.objects.filter(id=pk).exists())

    def test_another_child_cannot_see_or_delete_it(self):
        """مهم‌ترین تست: نقاشی شخصی است."""
        pk = self._save().json()["data"]["id"]
        self.api.force_authenticate(self.other)
        self.assertEqual(self.api.get(f"/api/v1/paintings/{pk}/image").status_code, 404)
        self.assertEqual(self.api.delete(f"/api/v1/paintings/{pk}").status_code, 404)
        self.assertTrue(Painting.objects.filter(id=pk).exists())

    def test_anonymous_gets_nothing(self):
        pk = self._save().json()["data"]["id"]
        self.api.force_authenticate(None)
        self.assertEqual(self.api.get("/api/v1/paintings").status_code, 401)
        self.assertEqual(self.api.get(f"/api/v1/paintings/{pk}/image").status_code, 401)

    def test_a_huge_image_is_rejected(self):
        res = self._save(image="data:image/png;base64," + "A" * 1_000_000)
        self.assertEqual(res.status_code, 400)
        self.assertFalse(Painting.objects.filter(user=self.kid).exists())

    def test_non_image_payload_is_rejected(self):
        res = self._save(image="javascript:alert(1)")
        self.assertEqual(res.status_code, 400)

    def test_oldest_paintings_are_dropped_past_the_cap(self):
        from apps.health.views import MAX_PAINTINGS
        for _ in range(MAX_PAINTINGS + 3):
            Painting.objects.create(user=self.kid, thumbnail=THUMB, image=PNG)
        self._save(title="تازه‌ترین")
        self.assertEqual(Painting.objects.filter(user=self.kid).count(), MAX_PAINTINGS)
        newest = Painting.objects.filter(user=self.kid).first()
        self.assertEqual(newest.title, "تازه‌ترین")
