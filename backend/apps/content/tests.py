"""
پادکست از صفر تا صد: بارگذاری در پنلِ ادمین ← فایل روی دیسک ← API عمومی
با نشانیِ کامل ← ثبتِ گوش‌دادن. تا ۴ اکتبر ۲۰۲۶ ادمین فقط «نشانی» می‌گرفت
و سایت اصلاً API را صدا نمی‌زد.
"""
import shutil
import sys
import tempfile
from pathlib import Path
from types import SimpleNamespace

from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from unittest import skipIf
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.models import User

from .models import PODCAST_MAX_MB, Podcast, PodcastListen, validate_podcast_audio_size

SITE = "https://my.luko.ir"


# Django 5.1 روی پایتونِ ۳.۱۴ کپیِ Context را در کلاینتِ تست نمی‌تواند (فقط وقتی قالبی رندر
# شود). سرور و ایمیجِ داکر پایتونِ ۳.۱۲ دارند و این تست‌ها آن‌جا پیش از هر دیپلو اجرا می‌شوند.
renders_template = skipIf(sys.version_info >= (3, 14), "Django 5.1 + Python 3.14: Context.__copy__")


def mp3(name="episode.mp3", size=2048):
    # محتوا برای جنگو مهم نیست؛ پسوند و حجم چک می‌شود
    return SimpleUploadedFile(name, b"ID3" + b"\0" * size, content_type="audio/mpeg")


class MediaTestBase(TestCase):
    def setUp(self):
        self.media = tempfile.mkdtemp(prefix="luko-media-")
        self.addCleanup(shutil.rmtree, self.media, ignore_errors=True)
        override = override_settings(MEDIA_ROOT=self.media, SITE_URL=SITE)
        override.enable()
        self.addCleanup(override.disable)
        self.api = APIClient()


class PodcastApiTests(MediaTestBase):
    def setUp(self):
        super().setUp()
        self.uploaded = Podcast.objects.create(title="قصه‌ی ماه", category="قصه", sort=2,
                                               audio_file=mp3(), duration_minutes=7)
        self.linked = Podcast.objects.create(title="ستاره‌ها", category="علمی", sort=1,
                                             audio_url="https://cdn.example.com/stars.mp3")
        self.silent = Podcast.objects.create(title="بی‌صدا", category="قصه", sort=0)
        Podcast.objects.create(title="خاموش", category="خواب", audio_file=mp3("off.mp3"), is_active=False)

    def test_list_is_public_and_only_has_playable_episodes(self):
        res = self.api.get("/api/v1/podcasts")
        self.assertEqual(res.status_code, 200)
        data = res.json()["data"]
        # ترتیبِ «ترتیب نمایش» از ادمین — تا امروز Meta آن را گم کرده بود
        self.assertEqual([e["title"] for e in data["episodes"]], ["ستاره‌ها", "قصه‌ی ماه"])
        self.assertIn(data["today"]["title"], {"ستاره‌ها", "قصه‌ی ماه"})
        self.assertEqual(data["categories"], ["علمی", "قصه"])
        self.assertFalse(any(e["listened"] for e in data["episodes"]))

    def test_uploaded_file_gets_absolute_https_url_and_is_on_disk(self):
        episode = next(e for e in self.api.get("/api/v1/podcasts").json()["data"]["episodes"]
                       if e["title"] == "قصه‌ی ماه")
        self.assertRegex(episode["audioUrl"], r"^https://my\.luko\.ir/media/podcasts/\d{4}/\d{2}/episode[\w-]*\.mp3$")
        relative = episode["audioUrl"].removeprefix(f"{SITE}/media/")
        self.assertTrue((Path(self.media) / relative).is_file())
        self.assertEqual(episode["durationMinutes"], 7)

    def test_external_link_is_returned_as_is(self):
        episode = next(e for e in self.api.get("/api/v1/podcasts").json()["data"]["episodes"]
                       if e["title"] == "ستاره‌ها")
        self.assertEqual(episode["audioUrl"], "https://cdn.example.com/stars.mp3")

    def test_listen_is_recorded_for_kid_and_flag_comes_back(self):
        kid = User.objects.create_user("09120007001", role="student")
        self.api.force_authenticate(kid)
        res = self.api.post(f"/api/v1/podcasts/{self.uploaded.id}/listen", {"seconds": 420}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(PodcastListen.objects.get(user=kid).seconds, 420)
        flags = {e["title"]: e["listened"] for e in self.api.get("/api/v1/podcasts").json()["data"]["episodes"]}
        self.assertEqual(flags, {"ستاره‌ها": False, "قصه‌ی ماه": True})

    def test_listen_needs_login_and_a_playable_episode(self):
        res = self.api.post(f"/api/v1/podcasts/{self.uploaded.id}/listen", {}, format="json")
        self.assertEqual(res.status_code, 401)
        self.api.force_authenticate(User.objects.create_user("09120007002", role="student"))
        res = self.api.post(f"/api/v1/podcasts/{self.silent.id}/listen", {}, format="json")
        self.assertEqual(res.status_code, 404)

    def test_empty_catalog(self):
        Podcast.objects.all().delete()
        data = self.api.get("/api/v1/podcasts").json()["data"]
        self.assertEqual((data["episodes"], data["today"], data["categories"]), ([], None, []))


class PodcastAdminTests(MediaTestBase):
    def setUp(self):
        super().setUp()
        self.admin = User.objects.create_superuser("09120007099", "Admin-Pass-1")
        self.client.force_login(self.admin)
        self.add_url = reverse("admin:content_podcast_add")

    def form(self, **extra):
        data = {"title": "سفر به فضا", "category": "علمی", "icon": "HiOutlineRocketLaunch",
                "duration_minutes": "8", "audio_url": "", "is_active": "on", "sort": "0"}
        data.update(extra)
        return data

    @renders_template
    def test_upload_from_admin_reaches_the_site(self):
        res = self.client.post(self.add_url, self.form(audio_file=mp3("space trip.mp3")))
        self.assertEqual(res.status_code, 302, getattr(res, "context", None) and res.context["adminform"].form.errors)
        podcast = Podcast.objects.get(title="سفر به فضا")
        self.assertTrue(podcast.audio_file.name.startswith("podcasts/"))
        self.assertTrue(Path(podcast.audio_file.path).is_file())
        episodes = self.api.get("/api/v1/podcasts").json()["data"]["episodes"]
        self.assertEqual([e["title"] for e in episodes], ["سفر به فضا"])
        # صفحه‌ی ویرایش پیش‌شنو دارد
        page = self.client.get(reverse("admin:content_podcast_change", args=[podcast.id]))
        self.assertContains(page, "<audio controls")
        self.assertContains(page, podcast.audio_file.url)
        self.assertContains(page, "content/podcast_admin.js")

    def test_editing_without_new_file_keeps_the_old_one(self):
        self.client.post(self.add_url, self.form(audio_file=mp3()))
        podcast = Podcast.objects.get()
        old = podcast.audio_file.name
        res = self.client.post(reverse("admin:content_podcast_change", args=[podcast.id]),
                               self.form(title="سفر به فضا ۲"))
        self.assertEqual(res.status_code, 302)
        podcast.refresh_from_db()
        self.assertEqual((podcast.title, podcast.audio_file.name), ("سفر به فضا ۲", old))

    @renders_template
    def test_audio_is_required(self):
        res = self.client.post(self.add_url, self.form())
        self.assertEqual(res.status_code, 200)
        self.assertContains(res, "فایلِ صوتی را بارگذاری کنید")
        self.assertFalse(Podcast.objects.exists())

    @renders_template
    def test_non_audio_file_is_rejected(self):
        page = SimpleUploadedFile("evil.html", b"<script>alert(1)</script>", content_type="text/html")
        res = self.client.post(self.add_url, self.form(audio_file=page))
        self.assertEqual(res.status_code, 200)
        self.assertFalse(Podcast.objects.exists())
        self.assertFalse(any(Path(self.media).rglob("evil*")))
        # پیش‌شنو فایلِ ردشده را صدا نمی‌زند
        self.assertNotContains(res, "<audio")

    @renders_template
    def test_rejected_reupload_keeps_preview_of_the_saved_file(self):
        self.client.post(self.add_url, self.form(audio_file=mp3("good.mp3")))
        podcast = Podcast.objects.get()
        bad = SimpleUploadedFile("bad.txt", b"x", content_type="text/plain")
        res = self.client.post(reverse("admin:content_podcast_change", args=[podcast.id]),
                               self.form(audio_file=bad))
        self.assertEqual(res.status_code, 200)
        self.assertContains(res, f'src="{podcast.audio_file.url}"')
        self.assertNotContains(res, "bad.txt\"")

    @renders_template
    def test_http_link_is_rejected(self):
        res = self.client.post(self.add_url, self.form(audio_url="http://example.com/a.mp3"))
        self.assertContains(res, "https://")
        self.assertFalse(Podcast.objects.exists())

    def test_toggle_in_list_does_not_crash_on_rows_without_audio(self):
        # ردیف‌های قدیمیِ بی‌صدا (seed) هنوز در فهرستِ ادمین هستند
        old = Podcast.objects.create(title="قدیمی", category="قصه", sort=0)
        res = self.client.post(reverse("admin:content_podcast_changelist"), {
            "form-TOTAL_FORMS": "1", "form-INITIAL_FORMS": "1",
            "form-MIN_NUM_FORMS": "0", "form-MAX_NUM_FORMS": "1000",
            "form-0-id": str(old.id), "form-0-sort": "3", "_save": "ذخیره",
        })
        self.assertEqual(res.status_code, 302)
        old.refresh_from_db()
        self.assertEqual((old.sort, old.is_active), (3, False))

    def test_size_limit(self):
        validate_podcast_audio_size(SimpleNamespace(size=PODCAST_MAX_MB * 1024 * 1024))
        with self.assertRaises(ValidationError):
            validate_podcast_audio_size(SimpleNamespace(size=PODCAST_MAX_MB * 1024 * 1024 + 1))
