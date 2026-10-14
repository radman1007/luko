"""صفحه‌ی «آموزش» پنلِ والدین و مدیریتش در داشبورد."""
import shutil
import tempfile
import uuid
from datetime import timedelta

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.billing.services import gift_subscription
from apps.dashboard.tests.base import DashboardTestBase
from apps.games.models import Book, ConceptTag, Game
from apps.games.telemetry import store_events
from apps.learn.models import LearnItem, LearnProgress
from apps.learn.services import media
from apps.parent.models import ParentChild

BODY = "بندِ اولِ مقاله درباره‌ی تمرین.\n\nبندِ دوم با نکته‌ی مهم.\n\nبندِ سومِ پنهان برای مشترکان.\n\n- نکته‌ی پنهان"


def article(title, *, topic="learning", premium=False, featured=False, **kw):
    return LearnItem.objects.create(kind="article", title=title, summary="خلاصه", topic=topic, body=BODY,
                                    premium=premium, featured=featured, status="published", **kw)


class LearnParentTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        LearnItem.objects.all().delete()          # مقاله‌های آغازینِ مهاجرت؛ این‌جا داده‌ی خودمان را می‌خواهیم
        cls.parent = User.objects.create(phone="09121119301", role=User.Role.PARENT)
        cls.kid = User.objects.create(phone="09121119302", role=User.Role.STUDENT, first_name="سارا", grade=1)
        cls.admin = User.objects.create(phone="09121119303", role=User.Role.TEAM_ADMIN, is_staff=True)
        ParentChild.objects.create(parent=cls.parent, child=cls.kid)
        cls.free = article("مقاله‌ی رایگان", featured=True)
        cls.paid = article("مقاله‌ی ویژه", topic="health", premium=True)
        cls.video = LearnItem.objects.create(kind="video", title="ویدیوی ویژه", topic="habits", premium=True,
                                             status="published", media_url="https://www.aparat.com/v/abc123XY")
        cls.draft = LearnItem.objects.create(kind="article", title="پیش‌نویس", body="متن", status="draft")
        cls.future = article("آینده", published_at=timezone.now() + timedelta(days=2))

    def setUp(self):
        self.api = APIClient()
        self.api.force_authenticate(self.parent)

    def list(self, **params):
        return self.api.get("/api/v1/parent/learn", params).json()["data"]

    def test_list_counts_and_free_plan_locks(self):
        data = self.list()
        titles = [i["title"] for i in data["items"]]
        self.assertNotIn("پیش‌نویس", titles)
        self.assertNotIn("آینده", titles)
        self.assertEqual(data["counts"], {"article": 2, "video": 1, "podcast": 0})
        self.assertEqual(data["featured"]["title"], "مقاله‌ی رایگان")
        self.assertFalse(data["premium"])
        self.assertEqual(data["locked"], 2)
        locked = {i["title"]: i["locked"] for i in data["items"]}
        self.assertEqual(locked, {"مقاله‌ی رایگان": False, "مقاله‌ی ویژه": True, "ویدیوی ویژه": True})
        self.assertEqual({t["key"] for t in data["topics"]}, {"learning", "health", "habits"})

    def test_locked_detail_never_sends_the_rest_or_the_media(self):
        data = self.api.get(f"/api/v1/parent/learn/{self.paid.pk}").json()["data"]
        self.assertTrue(data["locked"])
        self.assertIn("بندِ اولِ", data["bodyHtml"])
        self.assertNotIn("پنهان", data["bodyHtml"])
        video = self.api.get(f"/api/v1/parent/learn/{self.video.pk}").json()["data"]
        self.assertIsNone(video["media"])

    def test_subscription_opens_everything(self):
        gift_subscription(child=self.kid, days=30, granted_by=self.admin)
        self.assertTrue(self.list()["premium"])
        data = self.api.get(f"/api/v1/parent/learn/{self.paid.pk}").json()["data"]
        self.assertFalse(data["locked"])
        self.assertIn("پنهان", data["bodyHtml"])
        self.assertIn("<li>", data["bodyHtml"])
        video = self.api.get(f"/api/v1/parent/learn/{self.video.pk}").json()["data"]
        self.assertEqual(video["media"], {"type": "embed",
                                          "src": "https://www.aparat.com/video/video/embed/videohash/abc123XY/vt/frame"})

    def test_views_progress_and_related(self):
        data = self.api.get(f"/api/v1/parent/learn/{self.free.pk}").json()["data"]
        self.api.get(f"/api/v1/parent/learn/{self.free.pk}")
        self.free.refresh_from_db()
        self.assertEqual(self.free.views, 1)                     # هر والد یک بار
        self.assertEqual(len(data["related"]), 2)
        res = self.api.post(f"/api/v1/parent/learn/{self.free.pk}/progress", {"saved": True, "seconds": 40},
                            format="json").json()["data"]
        self.assertEqual((res["saved"], res["done"], res["seconds"]), (True, False, 40))
        self.api.post(f"/api/v1/parent/learn/{self.free.pk}/progress", {"done": True}, format="json")
        row = next(i for i in self.list()["items"] if i["id"] == self.free.pk)
        self.assertEqual((row["saved"], row["done"]), (True, True))
        self.assertEqual(self.api.get(f"/api/v1/parent/learn/{self.draft.pk}").status_code, 404)
        self.assertEqual(self.api.post(f"/api/v1/parent/learn/{self.free.pk}/progress", {"seconds": "x"},
                                       format="json").status_code, 400)

    def test_picks_follow_the_childs_report(self):
        # بچه‌ای که این هفته بازی نکرده → عادت (و اگر نبود، چیزی نمی‌آید)
        data = self.list(child=self.kid.pk)
        self.assertEqual(data["forChild"]["childName"], "سارا")
        pick = data["forChild"]["picks"][0]
        self.assertEqual(pick["item"]["title"], "ویدیوی ویژه")
        self.assertIn("هنوز بازی نکرده", pick["reason"])

        # بازیِ آخرِ شب → خواب و سلامت اول
        Book.objects.update_or_create(book_id="math-1", defaults={"title": "ریاضی", "subject": "ریاضی", "grade": 1})
        Game.objects.create(slug="g-m", title="بازی", book_id="math-1", grade=1, order=1, season_order=1)
        ConceptTag.objects.update_or_create(code="count", defaults={"title": "شمارش", "subject": "math"})
        late = timezone.localtime().replace(hour=23, minute=0) - timedelta(days=1)
        store_events(self.kid, [{"game_slug": "g-m", "event_type": "answer", "event_id": str(uuid.uuid4()),
                                 "session_id": "s", "concept_tag": "count", "is_correct": i % 2 == 0,
                                 "attempt_number": 1, "occurred_at": int((late + timedelta(seconds=i)).timestamp() * 1000)}
                                for i in range(12)])
        from django.core.cache import cache
        cache.clear()
        picks = self.list(child=self.kid.pk)["forChild"]["picks"]
        self.assertEqual(picks[0]["item"]["title"], "مقاله‌ی ویژه")          # موضوعِ خواب
        self.assertIn("آخرِ شب", picks[0]["reason"])
        self.assertEqual(picks[1]["item"]["title"], "مقاله‌ی رایگان")        # «شمارش» → یادگیری
        self.assertIn("«شمارش»", picks[1]["reason"])

    def test_child_of_another_parent_is_ignored(self):
        other = User.objects.create(phone="09121119304", role=User.Role.STUDENT)
        self.assertIsNone(self.list(child=other.pk)["forChild"])

    def test_students_cannot_read(self):
        kid = APIClient()
        kid.force_authenticate(self.kid)
        self.assertEqual(kid.get("/api/v1/parent/learn").status_code, 403)


class MediaTests(TestCase):
    def test_sources(self):
        cases = [
            (LearnItem(kind="video", media_url="https://www.aparat.com/v/Zx9"),
             {"type": "embed", "src": "https://www.aparat.com/video/video/embed/videohash/Zx9/vt/frame"}),
            (LearnItem(kind="video", media_url="https://cdn.example.com/a.mp4"),
             {"type": "video", "src": "https://cdn.example.com/a.mp4"}),
            (LearnItem(kind="podcast", media_url="https://cdn.example.com/a.mp3"),
             {"type": "audio", "src": "https://cdn.example.com/a.mp3"}),
            (LearnItem(kind="article", media_url="https://cdn.example.com/a.mp3"), None),
            (LearnItem(kind="video"), None),
        ]
        for item, expected in cases:
            with self.subTest(url=item.media_url):
                self.assertEqual(media(item), expected)


class SeedTests(TestCase):
    def test_seed_articles_exist(self):
        self.assertEqual(LearnItem.objects.filter(kind="article", status="published").count(), 12)
        self.assertTrue(LearnItem.objects.filter(premium=True).exists())
        self.assertTrue(LearnItem.objects.filter(featured=True, premium=False).exists())


class LearnDashboardTests(DashboardTestBase):
    def setUp(self):
        super().setUp()
        self.sign_in(self.admin)

    def test_create_video_with_file_publish_and_delete(self):
        res = self.post("learn", {"kind": "video", "title": "ویدیوی آزمایشی", "topic": "habits", "status": "published",
                                  "premium": "true", "media_file": SimpleUploadedFile("v.mp4", b"\0" * 64)},
                        format="multipart")
        self.assertEqual(res.status_code, 201, res.content)
        data = self.data(res)
        self.assertEqual((data["kind"], data["premium"], data["isLive"], data["media"]["type"]), ("video", True, True, "video"))
        item = LearnItem.objects.get(pk=data["id"])
        self.assertTrue(item.media_file.name.startswith("learn/media/"))
        self.assertEqual(self.patch(f"learn/{item.pk}", {"premium": "false"}, format="multipart").status_code, 200)
        item.refresh_from_db()
        self.assertFalse(item.premium)
        self.assertEqual(self.delete(f"learn/{item.pk}").status_code, 200)
        self.assertFalse(LearnItem.objects.filter(pk=item.pk).exists())

    def test_publishing_needs_the_right_content(self):
        no_media = self.post("learn", {"kind": "podcast", "title": "پادکست", "status": "published"}, format="multipart")
        self.assertEqual(no_media.status_code, 400)
        wrong = self.post("learn", {"kind": "podcast", "title": "پادکست", "status": "draft",
                                    "media_file": SimpleUploadedFile("v.mp4", b"\0" * 64)}, format="multipart")
        self.assertEqual(wrong.status_code, 400)
        empty = self.post("learn", {"kind": "article", "title": "مقاله", "status": "published"}, format="multipart")
        self.assertEqual(empty.status_code, 400)
        http = self.post("learn", {"kind": "video", "title": "ویدیو", "media_url": "http://x.com/a.mp4"}, format="multipart")
        self.assertEqual(http.status_code, 400)
        draft = self.post("learn", {"kind": "podcast", "title": "پادکست"}, format="multipart")
        self.assertEqual(draft.status_code, 201)                      # پیش‌نویسِ بی‌فایل مجاز است

    def test_list_filters_preview_and_permission(self):
        self.assertEqual(self.data(self.get("learn", kind="article"))["count"], 12)
        html = self.data(self.post("learn/preview", {"body": "<script>x</script> **ok**"}))["html"]
        self.assertNotIn("<script>", html)
        writer = self.make_staff("09120000901", ["blog"])
        self.sign_in(writer)
        self.assertEqual(self.get("learn").status_code, 403)
