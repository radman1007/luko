"""ارسالِ کدِ تأیید با ملی‌پیامک."""
from unittest.mock import patch

from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.accounts.otp import request_otp, verify_otp
from apps.common.sms import MeliPayamakBackend, SmsError, get_sms_backend


class FakeResponse:
    def __init__(self, payload, status_code=200, text=""):
        self._payload = payload
        self.status_code = status_code
        self.text = text or str(payload)

    def json(self):
        if self._payload is None:
            raise ValueError("not json")
        return self._payload


@override_settings(MELIPAYAMAK_API_KEY="test-key",
                   MELIPAYAMAK_BASE_URL="https://console.melipayamak.com",
                   MELIPAYAMAK_TIMEOUT=5)
class MeliPayamakBackendTests(TestCase):
    def test_url_and_body_match_the_documented_contract(self):
        with patch("apps.common.sms.requests.post") as post:
            post.return_value = FakeResponse({"code": "48219", "status": ""})
            MeliPayamakBackend().send_verify("09121110000", "ignored")

        url, kwargs = post.call_args[0][0], post.call_args[1]
        self.assertEqual(url, "https://console.melipayamak.com/api/send/otp/test-key")
        self.assertEqual(kwargs["json"], {"to": "09121110000"})

    def test_the_returned_code_is_what_counts(self):
        """کدِ ما فقط پیشنهاد است؛ مرجع همان است که سرویس فرستاده."""
        with patch("apps.common.sms.requests.post") as post:
            post.return_value = FakeResponse({"code": "48219", "status": ""})
            result = MeliPayamakBackend().send_verify("09121110000", "11111")
        self.assertEqual(result["code"], "48219")
        self.assertEqual(result["provider"], "melipayamak")

    def test_backend_declares_that_it_makes_its_own_code(self):
        self.assertTrue(MeliPayamakBackend.generates_code)

    def test_error_status_becomes_a_readable_message(self):
        with patch("apps.common.sms.requests.post") as post:
            post.return_value = FakeResponse({"code": "", "status": "اعتبار کافی نیست"}, 200)
            with self.assertRaises(SmsError) as ctx:
                MeliPayamakBackend().send_verify("09121110000", "11111")
        self.assertIn("اعتبار", ctx.exception.message)

    def test_failure_comes_back_as_http_200(self):
        """
        پاسخِ واقعیِ سرویس برای شماره‌ی نامعتبر: HTTP 200 بدونِ `code`.
        پس تکیه بر کدِ HTTP کافی نیست و نبودِ `code` باید خطا حساب شود.
        """
        with patch("apps.common.sms.requests.post") as post:
            post.return_value = FakeResponse({"status": "متن حاوی لینک می‌باشد"}, 200)
            with self.assertRaises(SmsError) as ctx:
                MeliPayamakBackend().send_verify("0912", "11111")
        # متنِ خامِ سرویس بی‌معناست؛ کاربر باید پیامِ درست ببیند
        self.assertEqual(ctx.exception.message, "شماره‌ی موبایل معتبر نیست.")
        self.assertIn("متن حاوی لینک", ctx.exception.detail)

    def test_unknown_error_falls_back_to_a_generic_message(self):
        with patch("apps.common.sms.requests.post") as post:
            post.return_value = FakeResponse({"status": "یک خطای ناشناخته"}, 200)
            with self.assertRaises(SmsError) as ctx:
                MeliPayamakBackend().send_verify("09121110000", "11111")
        self.assertIn("ناموفق", ctx.exception.message)

    def test_http_error_is_rejected(self):
        with patch("apps.common.sms.requests.post") as post:
            post.return_value = FakeResponse({"status": "کلید نامعتبر"}, 401)
            with self.assertRaises(SmsError):
                MeliPayamakBackend().send_verify("09121110000", "11111")

    def test_non_json_response_is_rejected(self):
        with patch("apps.common.sms.requests.post") as post:
            post.return_value = FakeResponse(None, 200, text="<html>خطا</html>")
            with self.assertRaises(SmsError):
                MeliPayamakBackend().send_verify("09121110000", "11111")

    def test_network_failure_is_rejected(self):
        import requests
        with patch("apps.common.sms.requests.post", side_effect=requests.Timeout("t")):
            with self.assertRaises(SmsError):
                MeliPayamakBackend().send_verify("09121110000", "11111")

    def test_missing_key_fails_before_any_request(self):
        with override_settings(MELIPAYAMAK_API_KEY=""):
            with patch("apps.common.sms.requests.post") as post:
                with self.assertRaises(SmsError):
                    MeliPayamakBackend().send_verify("09121110000", "11111")
                post.assert_not_called()

    @override_settings(SMS_BACKEND="melipayamak")
    def test_settings_select_the_backend(self):
        self.assertIsInstance(get_sms_backend(), MeliPayamakBackend)


@override_settings(SMS_BACKEND="melipayamak", MELIPAYAMAK_API_KEY="test-key")
class OtpWithMeliPayamakTests(TestCase):
    """جریانِ کامل: چیزی که ذخیره می‌شود باید همان چیزی باشد که ارسال شده."""

    def setUp(self):
        cache.clear()
        self.api = APIClient()

    def test_stored_code_is_the_provider_code_not_ours(self):
        phone = "09121113001"
        with patch("apps.common.sms.requests.post") as post:
            post.return_value = FakeResponse({"code": "907431", "status": ""})
            info = request_otp(phone)

        self.assertEqual(info["code"], "907431")
        self.assertEqual(info["length"], 6)
        # کدِ سرویس تأیید می‌شود
        self.assertTrue(verify_otp(phone, "907431"))

    def test_a_code_we_invented_is_rejected(self):
        phone = "09121113002"
        with patch("apps.common.sms.requests.post") as post:
            post.return_value = FakeResponse({"code": "555555", "status": ""})
            request_otp(phone)
        self.assertFalse(verify_otp(phone, "11111"))

    def test_ten_digit_code_works_end_to_end(self):
        """نمونه‌ی مستنداتشان ۱۰ رقمی بود؛ نباید جایی سخت‌کد شده باشد."""
        phone = "09121113003"
        with patch("apps.common.sms.requests.post") as post:
            post.return_value = FakeResponse({"code": "3741437414", "status": ""})
            info = request_otp(phone)
        self.assertEqual(info["length"], 10)
        self.assertTrue(verify_otp(phone, "3741437414"))

    def test_failed_send_stores_nothing_and_frees_the_resend_lock(self):
        phone = "09121113004"
        with patch("apps.common.sms.requests.post") as post:
            post.return_value = FakeResponse({"code": "", "status": "اعتبار کافی نیست"})
            with self.assertRaises(SmsError):
                request_otp(phone)

        self.assertFalse(verify_otp(phone, "anything"))
        # قفلِ ارسالِ مجدد آزاد شده، پس کاربر می‌تواند فوراً دوباره تلاش کند
        with patch("apps.common.sms.requests.post") as post:
            post.return_value = FakeResponse({"code": "246810", "status": ""})
            self.assertEqual(request_otp(phone)["code"], "246810")

    def test_api_tells_the_client_how_many_boxes_to_draw(self):
        with patch("apps.common.sms.requests.post") as post:
            post.return_value = FakeResponse({"code": "1234567", "status": ""})
            res = self.api.post("/api/v1/auth/request-otp", {"phone": "09121113005"},
                                format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["data"]["codeLength"], 7)

    def test_provider_failure_surfaces_as_502(self):
        with patch("apps.common.sms.requests.post") as post:
            post.return_value = FakeResponse({"code": "", "status": "اعتبار کافی نیست"})
            res = self.api.post("/api/v1/auth/request-otp", {"phone": "09121113006"},
                                format="json")
        self.assertEqual(res.status_code, 502)
        self.assertIn("اعتبار", res.json()["error"]["message"])
