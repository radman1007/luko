"""
تستِ لایه‌ی پیامک — هیچ درخواستِ واقعی به sms.ir زده نمی‌شود.

    USE_SQLITE=1 python manage.py test apps.accounts.tests.test_sms
"""
from unittest.mock import patch

import requests
from django.test import SimpleTestCase, override_settings

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
