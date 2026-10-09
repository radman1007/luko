"""پادکست و وبلاگ از راهِ API داشبورد."""
from pathlib import Path
from unittest import mock

import requests
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.blog.models import BlogImage, BlogPost
from apps.content.models import Podcast

from .base import PNG, DashboardTestBase


def mp3(name="ep.mp3"):
    return SimpleUploadedFile(name, b"ID3" + b"\0" * 1024, content_type="audio/mpeg")


class PodcastTests(DashboardTestBase):
    def setUp(self):
        super().setUp()
        offline = mock.patch("apps.content.admin.requests.get", side_effect=requests.ConnectionError("x"))
        offline.start()
        self.addCleanup(offline.stop)
        self.sign_in(self.admin)

    def test_create_with_file_edit_and_delete(self):
        res = self.post("podcasts", {"title": "قصه‌ی شب", "category": "مشاهیر ایرانی", "icon": "HiOutlineMoon",
                                     "durationMinutes": "5", "isActive": "true", "sort": "0", "audioFile": mp3()},
                        format="multipart")
        self.assertEqual(res.status_code, 201, res.content)
        row = self.data(res)
        self.assertTrue(row["audioSrc"].startswith("/media/podcasts/"))
        podcast = Podcast.objects.get()
        path = Path(podcast.audio_file.path)
        self.assertTrue(path.is_file())
        res = self.patch(f"podcasts/{podcast.pk}", {"isActive": False, "title": "قصه‌ی شبِ تازه"})
        self.assertEqual(res.status_code, 200, res.content)
        podcast.refresh_from_db()
        self.assertEqual((podcast.is_active, podcast.title, podcast.audio_file.name != ""), (False, "قصه‌ی شبِ تازه", True))
        self.assertEqual(self.delete(f"podcasts/{podcast.pk}").status_code, 200)
        self.assertFalse(Podcast.objects.exists())
        self.assertFalse(path.exists())

    def test_validation_messages(self):
        res = self.post("podcasts", {"title": "بی‌صدا", "category": "قصه", "isActive": "true", "sort": "0"},
                        format="multipart")
        self.assertEqual(res.status_code, 400)
        self.assertIn("فایلِ صوتی را بارگذاری کنید", self.message(res))
        res = self.post("podcasts", {"title": "بد", "category": "قصه", "sort": "0",
                                     "audioFile": SimpleUploadedFile("x.html", b"<b>")}, format="multipart")
        self.assertEqual(res.status_code, 400)

    def test_filters(self):
        Podcast.objects.create(title="الف", category="قصه", audio_url="https://cdn.example/a.mp3")
        Podcast.objects.create(title="ب", category="علمی")
        self.assertEqual(self.data(self.get("podcasts", audio="missing"))["count"], 1)
        self.assertEqual(self.data(self.get("podcasts", q="الف"))["count"], 1)
        self.assertEqual(self.data(self.get("podcasts", category="علمی"))["count"], 1)


class BlogTests(DashboardTestBase):
    def setUp(self):
        super().setUp()
        self.sign_in(self.admin)

    def test_write_publish_and_public_api(self):
        res = self.post("blog", {"title": "بازی و یادگیری", "summary": "خلاصه", "body": "# تیتر\n**مهم**",
                                 "tags": "بازی، تربیت", "category": "والدین", "status": "draft",
                                 "cover": SimpleUploadedFile("c.png", PNG, content_type="image/png")},
                        format="multipart")
        self.assertEqual(res.status_code, 201, res.content)
        post = BlogPost.objects.get()
        self.assertEqual((post.author_id, post.slug, post.status), (self.admin.pk, "بازی-و-یادگیری", "draft"))
        self.assertEqual(self.api.get("/api/v1/blog/posts").json()["data"]["count"], 0)      # پیش‌نویس عمومی نیست
        res = self.patch(f"blog/{post.pk}", {"status": "published"})
        self.assertEqual(res.status_code, 200, res.content)
        public = self.api.get("/api/v1/blog/posts").json()["data"]
        self.assertEqual(public["results"][0]["coverUrl"].startswith("https://my.luko.ir/media/blog/"), True)
        self.assertEqual(self.data(self.get("blog"))["results"][0]["isLive"], True)
        self.assertEqual(self.delete(f"blog/{post.pk}").status_code, 200)

    def test_image_upload_and_preview(self):
        res = self.post("blog/images", {"file": SimpleUploadedFile("a.png", PNG)}, format="multipart")
        self.assertEqual(res.status_code, 201)
        self.assertTrue(self.data(res)["markdown"].startswith("![](/media/blog/images/"))
        self.assertEqual(BlogImage.objects.count(), 1)
        bad = self.post("blog/images", {"file": SimpleUploadedFile("a.png", b"<svg onload=x>")}, format="multipart")
        self.assertEqual(bad.status_code, 400)
        html = self.data(self.post("blog/preview", {"body": "<script>x</script> **ok**"}))["html"]
        self.assertNotIn("<script>", html)
        self.assertIn("<strong>ok</strong>", html)

    def test_title_required(self):
        self.assertEqual(self.post("blog", {"title": "  "}, format="multipart").status_code, 400)


class BlogSeoTests(DashboardTestBase):
    def test_editor_gets_raw_seo_fields_not_fallbacks(self):
        self.sign_in(self.admin)
        res = self.post("blog", {"title": "عنوان", "summary": "خلاصه"}, format="multipart")
        data = self.data(res)
        self.assertEqual((data["seoTitle"], data["seoDescription"]), ("", ""))       # ویرایشگر خالی می‌بیند
        public = self.patch(f"blog/{data['id']}", {"status": "published"})
        self.assertEqual(self.data(public)["seoTitle"], "")
        slug = self.data(public)["slug"]
        self.assertEqual(self.api.get(f"/api/v1/blog/posts/{slug}").json()["data"]["seoTitle"], "عنوان")  # سایت جانشین دارد
