"""نقاشی‌های بچه در پنلِ والد و تحلیلِ هر نقاشی (با گیت‌وی ساختگی)."""
from unittest.mock import patch

from django.test import override_settings
from rest_framework.test import APIClient

from apps.ai.models import AIUsage, PaintingAnalysis
from apps.ai.paintings import analyze
from apps.billing.services import gift_subscription
from apps.health.models import Painting

from .test_flows import AI, AIFlowBase, FakeResponse, Gateway

IMAGE = "data:image/jpeg;base64," + "Q" * 300
READING = ("آنچه در نقاشی دیده می‌شود: دو قلب و یک خورشید.\nرنگ‌ها و حس: بیشتر آبی است (۷ stroke) و آن روز شاد بوده.\n"
           "- از سارا بپرسید داستانش چیست\n- نقاشی را به دیوار بزنید")


@override_settings(**AI)
class PaintingTests(AIFlowBase):
    def setUp(self):
        super().setUp()
        self.painting = Painting.objects.create(user=self.kid, mood="happy", title="خانه", thumbnail="data:image/jpeg;base64,T",
                                                image=IMAGE, colors={"#4696e5": 7, "#e5484d": 2})
        self.url = f"/api/v1/parent/children/{self.kid.id}/paintings"

    def request(self, gateway=None):
        gateway = gateway or Gateway(FakeResponse(200, READING))
        with patch("apps.ai.tasks.analyze_painting.delay", side_effect=analyze), patch("apps.ai.client._post", gateway):
            res = self.api.post(f"{self.url}/{self.painting.id}")
        return res, gateway

    def test_gallery_is_light_and_detail_has_the_image(self):
        data = self.api.get(self.url).json()["data"]
        row = data["items"][0]
        self.assertNotIn("image", row)
        self.assertEqual((row["title"], row["moodLabel"], row["analysis"]), ("خانه", "شاد", None))
        self.assertEqual(row["colors"][0], {"color": "#4696e5", "label": "آبی", "count": 7})
        self.assertFalse(data["premium"])
        detail = self.api.get(f"{self.url}/{self.painting.id}").json()["data"]
        self.assertEqual(detail["image"], IMAGE)

    def test_analysis_needs_a_subscription(self):
        res, gateway = self.request()
        self.assertEqual((res.status_code, res.json()["error"]["reason"]), (403, "locked"))
        self.assertEqual(gateway.bodies, [])

    def test_analysis_sends_the_image_and_is_kept(self):
        gift_subscription(child=self.kid, days=30, granted_by=self.admin)
        res, gateway = self.request()
        self.assertEqual(res.status_code, 202)
        body = gateway.bodies[0]
        self.assertEqual(body["model"], "GPT-5.6-Luna")
        text, image = body["messages"][0]["content"]
        self.assertEqual(image, {"type": "image_url", "image_url": {"url": IMAGE}})
        self.assertNotIn("سارا", text["text"])                       # نامِ بچه به مدل نمی‌رود
        self.assertIn("آبی", text["text"])
        analysis = self.api.get(f"{self.url}/{self.painting.id}").json()["data"]["analysis"]
        self.assertEqual(analysis["status"], "done")
        self.assertTrue(analysis["content"].startswith("**آنچه در نقاشی دیده می‌شود:** دو قلب"))
        self.assertIn("\n• نقاشی را به دیوار بزنید", analysis["content"])
        self.assertIn("(۷ خط)", analysis["content"])                    # واژه‌ی انگلیسیِ مدل جایگزین می‌شود
        self.assertEqual(AIUsage.objects.filter(feature="painting").count(), 1)
        # درخواستِ دوباره همان را نشان می‌دهد و مدل را صدا نمی‌زند
        res, gateway = self.request(Gateway())
        self.assertEqual((res.status_code, gateway.bodies), (202, []))

    def test_failed_analysis_can_be_retried(self):
        gift_subscription(child=self.kid, days=30, granted_by=self.admin)
        self.request(Gateway(FakeResponse(401)))
        self.assertEqual(PaintingAnalysis.objects.get().status, "failed")
        self.request()
        self.assertEqual(PaintingAnalysis.objects.get().status, "done")

    def test_only_this_childs_parent(self):
        stranger = APIClient()
        stranger.force_authenticate(self.other)
        self.assertEqual(stranger.get(self.url).status_code, 404)
        self.assertEqual(stranger.get(f"{self.url}/{self.painting.id}").status_code, 404)
        other_kid_painting = Painting.objects.create(user=self.admin, image=IMAGE)
        self.assertEqual(self.api.get(f"{self.url}/{other_kid_painting.id}").status_code, 404)
