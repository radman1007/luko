from datetime import timedelta
from types import SimpleNamespace

from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from .markdown import render
from .models import BlogPost
from .validators import validate_image

PNG = b"\x89PNG\r\n\x1a\n" + b"\0" * 64


class MarkdownSafetyTests(TestCase):
    def test_basic_formatting(self):
        out = render("# تیتر\n\nمتنِ **پررنگ** و *کج* با `کد`.\n\n- یک\n- دو\n\n1. اول\n2. دوم\n\n> نقل\n\n---")
        self.assertIn("<h2>تیتر</h2>", out)
        self.assertIn("<strong>پررنگ</strong>", out)
        self.assertIn("<em>کج</em>", out)
        self.assertIn("<code>کد</code>", out)
        self.assertIn("<ul><li>یک</li><li>دو</li></ul>", out)
        self.assertIn("<ol><li>اول</li><li>دوم</li></ol>", out)
        self.assertIn("<blockquote><p>نقل</p></blockquote>", out)
        self.assertIn("<hr>", out)

    def test_raw_html_never_passes(self):
        out = render('<script>alert(1)</script>\n<img src=x onerror="alert(1)">')
        self.assertNotIn("<script", out)
        self.assertNotIn("<img src=x", out)
        self.assertIn("&lt;script&gt;", out)

    def test_dangerous_links_and_images_are_dropped(self):
        for evil in ("javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html;base64,PHN", "//evil.example/x",
                     "vbscript:x"):
            out = render(f"[بزن]({evil}) ![عکس]({evil})")
            self.assertNotIn("<a ", out, evil)
            self.assertNotIn("<img", out, evil)

    def test_quotes_cannot_break_out_of_attributes(self):
        out = render('[x](https://a.example/"onmouseover="alert(1)) ![y](https://a.example/"onerror="alert(1))')
        self.assertNotIn('" onmouseover', out)
        self.assertNotIn('"onmouseover="', out)
        self.assertNotIn('"onerror="', out)

    def test_code_blocks_are_escaped(self):
        out = render("```\n<b>x</b> **y**\n```")
        self.assertIn("<pre><code>&lt;b&gt;x&lt;/b&gt; **y**</code></pre>", out)

    def test_links_and_media_images(self):
        out = render("[سایت](https://luko.ir) [داخلی](/parent-login) ![عکس](/media/blog/a.png)",
                     media_base="https://my.luko.ir")
        self.assertIn('<a href="https://luko.ir" target="_blank" rel="noopener nofollow">سایت</a>', out)
        self.assertIn('<a href="/parent-login">داخلی</a>', out)
        self.assertIn('<img src="https://my.luko.ir/media/blog/a.png" alt="عکس" loading="lazy">', out)
        self.assertNotIn("<img", render("![x](/static/../../etc)"))


class ImageValidatorTests(TestCase):
    def test_real_image_passes(self):
        validate_image(SimpleUploadedFile("a.png", PNG, content_type="image/png"))

    def test_fake_or_wrong_files_fail(self):
        for name, data in (("a.png", b"<svg onload=alert(1)>"), ("a.svg", PNG), ("a.html", PNG)):
            with self.assertRaises(ValidationError, msg=name):
                validate_image(SimpleUploadedFile(name, data))
        with self.assertRaises(ValidationError):
            big = SimpleNamespace(name="a.png", size=6 * 1024 * 1024, seek=lambda *_: None,
                                  read=lambda *_: PNG, tell=lambda: 0)
            validate_image(big)


@override_settings(SITE_URL="https://my.luko.ir", BLOG_CORS_ORIGINS=["https://luko.ir"])
class PublicApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        now = timezone.now()
        self.live = BlogPost.objects.create(title="بازی و یادگیری", summary="خلاصه", body="**سلام**",
                                            tags="تربیت، بازی", category="والدین", status="published")
        BlogPost.objects.create(title="پیش‌نویس", status="draft")
        BlogPost.objects.create(title="آینده", status="published", published_at=now + timedelta(days=2))
        BlogPost.objects.create(title="تربیتی", status="published", tags="تربیتی")

    def test_only_live_posts_are_listed(self):
        data = self.api.get("/api/v1/blog/posts").json()["data"]
        self.assertEqual(sorted(p["title"] for p in data["results"]), sorted(["بازی و یادگیری", "تربیتی"]))
        self.assertEqual(data["count"], 2)

    def test_detail_by_persian_slug_with_safe_html(self):
        self.assertEqual(self.live.slug, "بازی-و-یادگیری")
        data = self.api.get(f"/api/v1/blog/posts/{self.live.slug}").json()["data"]
        self.assertEqual(data["bodyHtml"], "<p><strong>سلام</strong></p>")
        self.assertEqual(data["tags"], ["تربیت", "بازی"])
        self.assertEqual(self.api.get("/api/v1/blog/posts/پیش‌نویس").status_code, 404)

    def test_exact_tag_filter_and_search(self):
        data = self.api.get("/api/v1/blog/posts", {"tag": "تربیت"}).json()["data"]
        self.assertEqual([p["title"] for p in data["results"]], ["بازی و یادگیری"])
        self.assertEqual(data["count"], 1)
        data = self.api.get("/api/v1/blog/posts", {"q": "یادگیری"}).json()["data"]
        self.assertEqual(data["count"], 1)

    def test_cors_only_for_the_landing(self):
        ok = self.api.get("/api/v1/blog/posts", HTTP_ORIGIN="https://luko.ir")
        self.assertEqual(ok["Access-Control-Allow-Origin"], "https://luko.ir")
        evil = self.api.get("/api/v1/blog/posts", HTTP_ORIGIN="https://evil.example")
        self.assertNotIn("Access-Control-Allow-Origin", evil)

    def test_slugs_stay_unique(self):
        again = BlogPost.objects.create(title="بازی و یادگیری")
        self.assertEqual(again.slug, "بازی-و-یادگیری-2")
