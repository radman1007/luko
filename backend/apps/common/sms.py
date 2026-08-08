"""
لایه‌ی ارسال پیامک.

فعلاً تنها ارائه‌دهنده sms.ir است، ولی همه‌ی کد از پشتِ این رابط صدا زده می‌شود
تا عوض کردنِ ارائه‌دهنده فقط یک کلاسِ تازه باشد.

قرارداد sms.ir (نسخه‌ی ۱):
    POST https://api.sms.ir/v1/send/verify
    هدر:  x-api-key: <کلید>
    بدنه: {"mobile": "09...", "templateId": 123, "parameters": [{"name": "CODE", "value": "12345"}]}
    موفق: HTTP 200 و {"status": 1, "message": "موفق", "data": {"messageId": ..., "cost": ...}}
    خطا:  HTTP 4xx/5xx و {"status": <کد>, "message": "<متن فارسی>", "data": null}
          (نمونه: status=113 یعنی «قالب یافت نشد»)

کلیدها و شناسه‌ی قالب فقط از متغیرهای محیطی خوانده می‌شوند؛ هرگز داخل کد نیایند.
"""
from __future__ import annotations

import logging

import requests
from django.conf import settings

log = logging.getLogger("luko.sms")

# کدهای پرتکرارِ sms.ir که پیامِ کاربرپسند برایشان داریم
SMSIR_MESSAGES = {
    11: "شماره‌ی گیرنده معتبر نیست.",
    12: "اعتبار پیامک تمام شده است.",
    101: "کلید API نامعتبر است.",
    103: "دسترسی این کلید API محدود شده است.",
    113: "قالبِ پیامک پیدا نشد.",
}


class SmsError(Exception):
    """ارسال پیامک ناموفق بود. arg[0] پیامِ قابل نمایش، arg[1] جزئیاتِ فنی."""

    def __init__(self, message: str, detail: str = ""):
        super().__init__(message, detail)
        self.message = message
        self.detail = detail


class BaseSmsBackend:
    def send_verify(self, phone: str, code: str) -> dict:  # pragma: no cover - رابط
        raise NotImplementedError


class ConsoleSmsBackend(BaseSmsBackend):
    """حالتِ توسعه: چیزی ارسال نمی‌شود، کد در لاگ می‌آید."""

    def send_verify(self, phone: str, code: str) -> dict:
        log.info("[console-sms] کد %s برای %s", code, phone)
        return {"provider": "console", "messageId": None, "cost": 0}


class SmsIrBackend(BaseSmsBackend):
    """ارسالِ کدِ تأیید با sms.ir (سرویسِ «ارسال کد تایید»)."""

    def __init__(self, api_key: str = "", template_id: int = 0, param_name: str = "",
                 base_url: str = "", timeout: float = 0):
        self.api_key = api_key or settings.SMS_IR_API_KEY
        self.template_id = int(template_id or settings.SMS_IR_TEMPLATE_ID or 0)
        self.param_name = param_name or settings.SMS_IR_PARAM_NAME
        self.base_url = (base_url or settings.SMS_IR_BASE_URL).rstrip("/")
        self.timeout = timeout or settings.SMS_IR_TIMEOUT

    def send_verify(self, phone: str, code: str) -> dict:
        if not self.api_key:
            raise SmsError("سرویس پیامک پیکربندی نشده است.", "SMS_IR_API_KEY خالی است")
        if not self.template_id:
            raise SmsError("سرویس پیامک پیکربندی نشده است.", "SMS_IR_TEMPLATE_ID خالی است")

        url = f"{self.base_url}/v1/send/verify"
        payload = {
            "mobile": phone,
            "templateId": self.template_id,
            "parameters": [{"name": self.param_name, "value": str(code)}],
        }
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "x-api-key": self.api_key,
        }

        try:
            response = requests.post(url, json=payload, headers=headers, timeout=self.timeout)
        except requests.Timeout as exc:
            raise SmsError("سرویس پیامک پاسخ نداد؛ چند لحظه بعد دوباره تلاش کن.", f"timeout: {exc}") from exc
        except requests.RequestException as exc:
            raise SmsError("ارتباط با سرویس پیامک برقرار نشد.", f"network: {exc}") from exc

        try:
            body = response.json()
        except ValueError:
            raise SmsError(
                "پاسخِ نامعتبر از سرویس پیامک.",
                f"http={response.status_code} body={response.text[:200]}",
            ) from None

        provider_status = body.get("status")
        if response.status_code != 200 or provider_status != 1:
            friendly = SMSIR_MESSAGES.get(provider_status, "ارسال پیامک ناموفق بود.")
            detail = f"http={response.status_code} status={provider_status} message={body.get('message')}"
            log.error("sms.ir ناموفق برای %s — %s", _mask(phone), detail)
            raise SmsError(friendly, detail)

        data = body.get("data") or {}
        log.info("sms.ir ارسال شد به %s (messageId=%s)", _mask(phone), data.get("messageId"))
        return {"provider": "sms.ir", "messageId": data.get("messageId"), "cost": data.get("cost")}


def _mask(phone: str) -> str:
    """شماره در لاگ کامل نوشته نشود."""
    return f"{phone[:4]}***{phone[-2:]}" if phone and len(phone) >= 6 else "***"


_BACKENDS = {"console": ConsoleSmsBackend, "smsir": SmsIrBackend}


def get_sms_backend() -> BaseSmsBackend:
    """ارائه‌دهنده‌ی فعال بر اساس SMS_BACKEND در تنظیمات."""
    name = (settings.SMS_BACKEND or "console").lower()
    backend = _BACKENDS.get(name)
    if backend is None:
        raise SmsError("سرویس پیامک پیکربندی نشده است.", f"SMS_BACKEND ناشناخته: {name}")
    return backend()


def send_verification_code(phone: str, code: str) -> dict:
    """تنها نقطه‌ای که بقیه‌ی کد برای فرستادنِ کدِ تأیید صدا می‌زند."""
    return get_sms_backend().send_verify(phone, code)
