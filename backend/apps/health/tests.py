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


class MoodFromDeviceTests(TestCase):
    """
    حالِ بچه تا ۲۵ مهر ۱۴۰۵ فقط در localStorage می‌ماند و هرگز به پنلِ والد نمی‌رسید. حالا هم مستقیم ثبت می‌شود
    و هم از راهِ هم‌رسانی (اپِ اندرویدیِ نصب‌شده فقط همین دومی را دارد) — و یک حال دوبار شمرده نمی‌شود.
    """

    @classmethod
    def setUpTestData(cls):
        cls.kid = User.objects.create(phone="09121115101", role=User.Role.STUDENT)

    def setUp(self):
        self.api = APIClient()
        self.api.force_authenticate(self.kid)
        self.versions = {}

    def sync(self, mood, at):
        changes = []
        for key, value in (("luko_last_mood", mood), ("luko_last_mood_time", str(at))):
            changes.append({"key": key, "value": value, "baseVersion": self.versions.get(key, 0)})
        res = self.api.post("/api/v1/sync", {"changes": changes}, format="json")
        self.assertEqual(res.status_code, 200)
        for row in res.json()["data"]["applied"]:
            self.versions[row["key"]] = row["version"]

    @staticmethod
    def ms(moment):
        return int(moment.timestamp() * 1000)

    def test_sync_records_the_mood_once_at_device_time(self):
        from datetime import timedelta

        from django.utils import timezone

        from apps.health.models import MoodCheckin

        at = timezone.now() - timedelta(hours=2)
        self.sync("sad", self.ms(at))
        checkin = MoodCheckin.objects.get(user=self.kid)
        self.assertEqual((checkin.mood, checkin.client_at), ("sad", self.ms(at)))
        self.assertLess(abs((checkin.created_at - at).total_seconds()), 1)
        # همان حال دوباره هم‌رسان شود (دستگاهِ دیگر، نسخه‌ی تازه) → دوباره شمرده نمی‌شود
        self.sync("sad", self.ms(at))
        self.assertEqual(MoodCheckin.objects.filter(user=self.kid).count(), 1)
        # حالِ تازه
        self.sync("happy", self.ms(timezone.now()))
        self.assertEqual(list(MoodCheckin.objects.filter(user=self.kid).values_list("mood", flat=True)), ["happy", "sad"])

    def test_direct_and_synced_are_the_same_mood(self):
        from django.utils import timezone

        from apps.health.models import MoodCheckin

        at = self.ms(timezone.now())
        res = self.api.post("/api/v1/moods/checkin", {"mood": "calm", "at": at}, format="json")
        self.assertEqual((res.status_code, res.json()["data"]["mood"]), (201, "calm"))
        self.sync("calm", at)
        self.assertEqual(MoodCheckin.objects.filter(user=self.kid).count(), 1)
        # همان درخواستِ مستقیم دوباره (شبکه‌ی ناپایدار) → باز یکی
        self.assertEqual(self.api.post("/api/v1/moods/checkin", {"mood": "calm", "at": at}, format="json").status_code,
                         201)
        self.assertEqual(MoodCheckin.objects.filter(user=self.kid).count(), 1)

    def test_wrong_clock_and_bad_values(self):
        from datetime import timedelta

        from django.utils import timezone

        from apps.health.models import MoodCheckin

        future = timezone.now() + timedelta(days=3)          # ساعتِ دستگاه جلوست → «اکنون» ثبت می‌شود
        self.sync("tired", self.ms(future))
        checkin = MoodCheckin.objects.get(user=self.kid)
        self.assertLess(abs((checkin.created_at - timezone.now()).total_seconds()), 5)
        self.sync("bored", self.ms(timezone.now()))          # حالِ ناشناخته
        self.assertEqual(MoodCheckin.objects.filter(user=self.kid).count(), 1)
