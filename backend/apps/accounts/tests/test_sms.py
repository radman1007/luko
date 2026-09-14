"""
تستِ لایه‌ی پیامک — هیچ درخواستِ واقعی به sms.ir زده نمی‌شود.

    USE_SQLITE=1 python manage.py test apps.accounts.tests.test_sms
"""
from unittest.mock import patch

import requests
from django.test import SimpleTestCase, TestCase, override_settings
from rest_framework.test import APIClient

from apps.accounts.otp import request_otp, verify_otp
from apps.accounts.utils import normalize_phone
from apps.common.sms import ConsoleSmsBackend, SmsError, SmsIrBackend, get_sms_backend

SMSIR = dict(
    SMS_BACKEND="smsir",
    SMS_IR_API_KEY="test-key",
    SMS_IR_TEMPLATE_ID="123456",
    SMS_IR_PARAM_NAME="CODE",
    SMS_IR_BASE_URL="https://api.sms.ir",
    SMS_IR_TIMEOUT=5,
)


class FakeResponse:
    def __init__(self, status_code, payload=None, text=""):
        self.status_code = status_code
        self._payload = payload
        self.text = text

    def json(self):
        if self._payload is None:
            raise ValueError("no json")
        return self._payload


@override_settings(**SMSIR)
class SmsIrBackendTests(SimpleTestCase):
    def test_successful_send_returns_message_id(self):
        ok = FakeResponse(200, {"status": 1, "message": "موفق",
                                "data": {"messageId": 987, "cost": 1.0}})
        with patch("apps.common.sms.requests.post", return_value=ok) as post:
            result = SmsIrBackend().send_verify("09121234567", "54321")

        self.assertEqual(result["messageId"], 987)
        _, kwargs = post.call_args
        self.assertEqual(kwargs["headers"]["x-api-key"], "test-key")
        self.assertEqual(kwargs["json"]["mobile"], "09121234567")
        self.assertEqual(kwargs["json"]["templateId"], 123456)
        self.assertEqual(kwargs["json"]["parameters"], [{"name": "CODE", "value": "54321"}])

    def test_provider_error_status_raises_friendly_message(self):
        bad = FakeResponse(400, {"status": 113, "message": "قالب یافت نشد", "data": None})
        with patch("apps.common.sms.requests.post", return_value=bad):
            with self.assertRaises(SmsError) as ctx:
                SmsIrBackend().send_verify("09121234567", "54321")
        self.assertIn("قالب", ctx.exception.message)
        self.assertIn("status=113", ctx.exception.detail)

    def test_http_200_but_status_not_one_is_failure(self):
        weird = FakeResponse(200, {"status": 12, "message": "اعتبار کافی نیست", "data": None})
        with patch("apps.common.sms.requests.post", return_value=weird):
            with self.assertRaises(SmsError):
                SmsIrBackend().send_verify("09121234567", "54321")

    def test_timeout_is_wrapped(self):
        with patch("apps.common.sms.requests.post", side_effect=requests.Timeout("boom")):
            with self.assertRaises(SmsError) as ctx:
                SmsIrBackend().send_verify("09121234567", "54321")
        self.assertIn("timeout", ctx.exception.detail)

    def test_non_json_body_is_wrapped(self):
        html = FakeResponse(500, None, text="<html>error</html>")
        with patch("apps.common.sms.requests.post", return_value=html):
            with self.assertRaises(SmsError):
                SmsIrBackend().send_verify("09121234567", "54321")

    @override_settings(SMS_IR_TEMPLATE_ID="")
    def test_missing_template_id_fails_before_network_call(self):
        with patch("apps.common.sms.requests.post") as post:
            with self.assertRaises(SmsError):
                SmsIrBackend().send_verify("09121234567", "54321")
        post.assert_not_called()


class BackendSelectionTests(SimpleTestCase):
    @override_settings(SMS_BACKEND="console")
    def test_console_backend_selected(self):
        self.assertIsInstance(get_sms_backend(), ConsoleSmsBackend)

    @override_settings(**SMSIR)
    def test_smsir_backend_selected(self):
        self.assertIsInstance(get_sms_backend(), SmsIrBackend)

    @override_settings(SMS_BACKEND="carrier-pigeon")
    def test_unknown_backend_raises(self):
        with self.assertRaises(SmsError):
            get_sms_backend()


class PhoneNormalizationTests(SimpleTestCase):
    def test_accepted_forms_all_normalize(self):
        for raw in ["09121234567", "+989121234567", "00989121234567",
                    "989121234567", "9121234567", "0912 123 4567", "۰۹۱۲۱۲۳۴۵۶۷"]:
            self.assertEqual(normalize_phone(raw), "09121234567", raw)

    def test_invalid_numbers_rejected(self):
        for raw in ["", None, "0812345678", "0912123456", "091212345678", "hello"]:
            self.assertIsNone(normalize_phone(raw), raw)


@override_settings(**SMSIR)
class OtpWithSmsIrTests(TestCase):
    """
    جریانِ کامل با sms.ir.

    برعکسِ ملی‌پیامک، این‌جا کد را **ما** می‌سازیم و sms.ir فقط می‌فرستد و
    در پاسخ کدی برنمی‌گرداند. پس چیزی که ذخیره و بعد تأیید می‌شود باید دقیقاً
    همان کدی باشد که در بدنه‌ی درخواست رفته — اگر لایه‌ی OTP به‌اشتباه منتظرِ
    «کدِ ارائه‌دهنده» بماند، هیچ کدی تأیید نمی‌شود.
    """

    def setUp(self):
        from apps.accounts.otp import _conn
        self.phone = "09121114001"
        _conn().delete(f"otp:code:{self.phone}", f"otp:resend:{self.phone}",
                       f"otp:att:{self.phone}", "otp:ip:127.0.0.1")
        self.api = APIClient()

    @staticmethod
    def _ok():
        return FakeResponse(200, {"status": 1, "message": "موفق",
                                  "data": {"messageId": 555, "cost": 1.0}})

    def test_the_code_in_the_sms_is_the_code_that_verifies(self):
        with patch("apps.common.sms.requests.post", return_value=self._ok()) as post:
            info = request_otp(self.phone)
        sent = post.call_args.kwargs["json"]["parameters"][0]["value"]
        self.assertEqual(info["code"], sent)
        self.assertEqual(info["length"], 5)
        self.assertTrue(verify_otp(self.phone, sent))

    def test_the_provider_reply_carries_no_code_and_that_is_fine(self):
        """پاسخِ sms.ir کلیدِ `code` ندارد؛ نبودنش نباید ارسالِ موفق را خطا کند."""
        with patch("apps.common.sms.requests.post", return_value=self._ok()):
            info = request_otp(self.phone)
        self.assertEqual(info["delivery"]["provider"], "sms.ir")
        self.assertEqual(info["delivery"]["messageId"], 555)

    def test_out_of_credit_stores_nothing_and_frees_the_resend_lock(self):
        broke = FakeResponse(200, {"status": 12, "message": "اعتبار کافی نیست", "data": None})
        with patch("apps.common.sms.requests.post", return_value=broke):
            with self.assertRaises(SmsError):
                request_otp(self.phone)
        self.assertFalse(verify_otp(self.phone, "00000"))
        with patch("apps.common.sms.requests.post", return_value=self._ok()):
            self.assertEqual(len(request_otp(self.phone)["code"]), 5)

    def test_api_tells_the_client_to_draw_five_boxes(self):
        with patch("apps.common.sms.requests.post", return_value=self._ok()):
            res = self.api.post("/api/v1/auth/request-otp", {"phone": self.phone},
                                format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["data"]["codeLength"], 5)

    def test_a_provider_failure_reaches_the_client_as_502_in_persian(self):
        missing = FakeResponse(400, {"status": 113, "message": "قالب یافت نشد", "data": None})
        with patch("apps.common.sms.requests.post", return_value=missing):
            res = self.api.post("/api/v1/auth/request-otp", {"phone": self.phone},
                                format="json")
        self.assertEqual(res.status_code, 502)
        self.assertIn("قالب", res.json()["error"]["message"])

    def test_the_whole_login_goes_through(self):
        with patch("apps.common.sms.requests.post", return_value=self._ok()) as post:
            self.api.post("/api/v1/auth/request-otp", {"phone": self.phone}, format="json")
        code = post.call_args.kwargs["json"]["parameters"][0]["value"]
        res = self.api.post("/api/v1/auth/verify-otp",
                            {"phone": self.phone, "code": code, "role": "student"},
                            format="json")
        self.assertIn(res.status_code, (200, 201))
        self.assertIn("accessToken", res.json()["data"])
