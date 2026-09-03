"""
لایه‌ی ارسال پیامک.

دو ارائه‌دهنده پشتِ یک رابط: هرکدام از یک مدلِ متفاوت پیروی می‌کنند و رابط
عمداً طوری است که هر دو در آن بگنجند.

* sms.ir → ما کد را می‌سازیم و او فقط می‌فرستد.
* ملی‌پیامک → **او** کد را می‌سازد، می‌فرستد، و در پاسخ می‌گوید چه فرستاده.

برای همین `send_verify` کدِ *واقعاً ارسال‌شده* را برمی‌گرداند؛ صدازننده باید
همان را ذخیره کند نه کدی که خودش پیشنهاد داده بود.

قرارداد ملی‌پیامک:
    POST https://console.melipayamak.com/api/send/otp/<کلید>
    بدنه: {"to": "09..."}
    پاسخ: {"code": "12345", "status": "<شرح خطا در صورت بروز>"}

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


# ملی‌پیامک حتی هنگامِ خطا هم HTTP 200 می‌دهد و شرحِ خطا را در `status`
# می‌گذارد؛ متنِ خامش گاهی برای کاربر بی‌معناست (مثلاً برای شماره‌ی نامعتبر
# «متن حاوی لینک می‌باشد» برمی‌گرداند). این نگاشت پیامِ قابل‌فهم می‌سازد.
MELIPAYAMAK_HINTS = (
    ("اعتبار", "اعتبار پیامک تمام شده است."),
    ("لینک", "شماره‌ی موبایل معتبر نیست."),
    ("شماره", "شماره‌ی موبایل معتبر نیست."),
    ("موبایل", "شماره‌ی موبایل معتبر نیست."),
    ("کلید", "کلید سرویس پیامک معتبر نیست."),
    ("دسترسی", "دسترسی سرویس پیامک محدود شده است."),
)


def _melipayamak_message(status: str) -> str:
    """شرحِ خامِ سرویس → پیامی که نشان‌دادنش به کاربر معنا دارد."""
    for needle, friendly in MELIPAYAMAK_HINTS:
        if needle in status:
            return friendly
    return "ارسال پیامک ناموفق بود؛ شماره را بررسی کن یا کمی بعد دوباره تلاش کن."


class SmsError(Exception):
    """ارسال پیامک ناموفق بود. arg[0] پیامِ قابل نمایش، arg[1] جزئیاتِ فنی."""

    def __init__(self, message: str, detail: str = ""):
        super().__init__(message, detail)
        self.message = message
        self.detail = detail


class BaseSmsBackend:
    #: ارائه‌دهنده خودش کد را می‌سازد؟ (آن‌وقت `code`ِ ورودی نادیده گرفته می‌شود)
    generates_code = False

    def send_verify(self, phone: str, code: str) -> dict:  # pragma: no cover - رابط
        """کدِ واقعاً ارسال‌شده را در کلیدِ `code` برمی‌گرداند."""
        raise NotImplementedError


class ConsoleSmsBackend(BaseSmsBackend):
    """حالتِ توسعه: چیزی ارسال نمی‌شود، کد در لاگ می‌آید."""

    def send_verify(self, phone: str, code: str) -> dict:
        log.info("[console-sms] کد %s برای %s", code, phone)
        return {"provider": "console", "code": str(code), "messageId": None, "cost": 0}


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
        return {"provider": "sms.ir", "code": str(code),
                "messageId": data.get("messageId"), "cost": data.get("cost")}


class MeliPayamakBackend(BaseSmsBackend):
    """
    ارسالِ کدِ تأیید با ملی‌پیامک.

    برخلافِ sms.ir، اینجا کد را خودِ سرویس می‌سازد و در پاسخ برمی‌گرداند؛
    پس کدی که به این متد داده می‌شود دور ریخته می‌شود و آنچه ذخیره و بعداً
    بررسی می‌شود، همان چیزی است که واقعاً برای کاربر رفته است.
    """

    generates_code = True

    def __init__(self, api_key: str = "", base_url: str = "", timeout: float = 0):
        self.api_key = api_key or settings.MELIPAYAMAK_API_KEY
        self.base_url = (base_url or settings.MELIPAYAMAK_BASE_URL).rstrip("/")
        self.timeout = timeout or settings.MELIPAYAMAK_TIMEOUT

    def send_verify(self, phone: str, code: str) -> dict:
        if not self.api_key:
            raise SmsError("سرویس پیامک پیکربندی نشده است.", "MELIPAYAMAK_API_KEY خالی است")

        url = f"{self.base_url}/api/send/otp/{self.api_key}"
        try:
            response = requests.post(url, json={"to": phone}, timeout=self.timeout)
        except requests.Timeout as exc:
            raise SmsError("سرویس پیامک پاسخ نداد؛ چند لحظه بعد دوباره تلاش کن.",
                           f"timeout: {exc}") from exc
        except requests.RequestException as exc:
            raise SmsError("ارتباط با سرویس پیامک برقرار نشد.", f"network: {exc}") from exc

        try:
            body = response.json()
        except ValueError:
            raise SmsError(
                "پاسخِ نامعتبر از سرویس پیامک.",
                f"http={response.status_code} body={response.text[:200]}",
            ) from None

        sent_code = str(body.get("code") or "").strip()
        status = str(body.get("status") or "").strip()

        # موفقیت یعنی کدِ عددی برگشته باشد؛ `status` جای شرحِ خطاست.
        if response.status_code != 200 or not sent_code.isdigit():
            detail = f"http={response.status_code} status={status or body}"
            log.error("ملی‌پیامک ناموفق برای %s — %s", _mask(phone), detail)
            raise SmsError(_melipayamak_message(status), detail)

        log.info("ملی‌پیامک ارسال شد به %s (طولِ کد=%s)", _mask(phone), len(sent_code))
        return {"provider": "melipayamak", "code": sent_code, "messageId": None, "cost": None}


def _mask(phone: str) -> str:
    """شماره در لاگ کامل نوشته نشود."""
    return f"{phone[:4]}***{phone[-2:]}" if phone and len(phone) >= 6 else "***"


_BACKENDS = {
    "console": ConsoleSmsBackend,
    "smsir": SmsIrBackend,
    "melipayamak": MeliPayamakBackend,
}


def get_sms_backend() -> BaseSmsBackend:
    """ارائه‌دهنده‌ی فعال بر اساس SMS_BACKEND در تنظیمات."""
    name = (settings.SMS_BACKEND or "console").lower()
    backend = _BACKENDS.get(name)
    if backend is None:
        raise SmsError("سرویس پیامک پیکربندی نشده است.", f"SMS_BACKEND ناشناخته: {name}")
    return backend()


def send_verification_code(phone: str, code: str) -> dict:
    """
    تنها نقطه‌ای که بقیه‌ی کد برای فرستادنِ کدِ تأیید صدا می‌زند.

    `code` فقط یک پیشنهاد است: ارائه‌دهنده‌هایی که خودشان کد می‌سازند آن را
    نادیده می‌گیرند. کدِ معتبر همیشه همان است که در خروجی برمی‌گردد.
    """
    return get_sms_backend().send_verify(phone, code)
