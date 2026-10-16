"""
درگاهِ پرداختِ زیبال. https://help.zibal.ir/ipg (مشخصاتِ کامل: api.zibal.ir/static/helpdocs/ipg.json)

    request   POST /v1/request  {merchant, amount(ریال), callbackUrl, orderId, description, mobile}
                                → {result: 100, trackId}
    پرداخت    GET  /start/<trackId>   (مرورگرِ والد؛ Referer باید دامنه‌ی ثبت‌شده‌ی درگاه باشد)
    بازگشت    GET  callbackUrl?trackId=…&success=1|0&status=…&orderId=…
    verify    POST /v1/verify   {merchant, trackId} → {result: 100 | 201 (قبلاً تأیید شده) | 202 (پرداخت نشده), …}
    inquiry   POST /v1/inquiry  {merchant, trackId} → {result: 100, status, amount, refNumber, cardNumber, …}

نکته‌ها از مستندات:
  - تراکنشی که تا ۲۰ دقیقه بعد از پرداخت تأیید نشود، پولش به کارتِ پرداخت‌کننده برمی‌گردد.
  - `status` در inquiry: ۱ پرداخت‌شده و تأییدشده، ۲ پرداخت‌شده و تأییدنشده، ‎-1 در انتظار، ۳ لغو، بقیه ناموفق.
  - خطاهای منطقی با HTTP 200 و `result` غیرِ ۱۰۰ برمی‌گردند (مثلاً ۱۱۵: IPِ سرور در پنل ثبت نشده).

کدِ پذیرنده فقط از متغیرِ محیطیِ ZIBAL_MERCHANT خوانده می‌شود (مخزن عمومی است). برای آزمون: «zibal».
"""
from __future__ import annotations

import logging

import requests
from django.conf import settings

log = logging.getLogger("luko.billing")

#: سقفِ وصل شدن جدا از سقفِ پاسخ: gateway.zibal.ir دو نشانی دارد و با سقفِ یکسانِ ۱۵ ثانیه، درگاهِ در دسترس
#: نبودن ۳۰ ثانیه طول می‌کشید — همان سقفِ درخواستِ پنل، پس والد به‌جای پیامِ روشن «انجام نشد» می‌دید
CONNECT_TIMEOUT = 5

RESULT_OK = 100
RESULT_ALREADY_VERIFIED = 201
RESULT_NOT_PAID = 202
RESULT_BAD_TRACK = 203

#: وضعیتِ پرداخت (inquiry و بازگشت)
STATUS_PENDING = -1
STATUS_VERIFIED = 1
STATUS_PAID_UNVERIFIED = 2
STATUS_CANCELLED = 3

#: پیامِ وضعیت‌ها برای صورت‌حساب
STATUS_MESSAGES = {
    -2: "خطای داخلیِ درگاه",
    -1: "در انتظارِ پرداخت",
    1: "پرداخت‌شده و تأییدشده",
    2: "پرداخت‌شده و تأییدنشده",
    3: "پرداخت را لغو کردید",
    4: "شماره‌ی کارت نامعتبر بود",
    5: "موجودیِ حساب کافی نبود",
    6: "رمزِ واردشده اشتباه بود",
    7: "تعدادِ درخواست‌ها بیش از حدِ مجاز بود",
    8: "تعدادِ پرداختِ اینترنتیِ روزانه بیش از حدِ مجاز بود",
    9: "مبلغِ پرداختِ اینترنتیِ روزانه بیش از حدِ مجاز بود",
    10: "صادرکننده‌ی کارت نامعتبر بود",
    11: "خطای سوییچِ بانکی",
    12: "کارت در دسترس نبود",
    15: "تراکنش برگشت داده شد",
    16: "تراکنش در حالِ برگشت است",
    18: "تراکنش برگشت خورد",
    21: "پذیرنده نامعتبر است",
}

#: پیامِ کدهای ساختِ پرداخت که کارِ ماست، نه والد (برای لاگ و پشتیبانی)
REQUEST_RESULTS = {
    102: "merchant یافت نشد",
    103: "merchant غیرفعال است یا قرارداد امضا نشده",
    104: "merchant نامعتبر است",
    105: "مبلغ باید بیشتر از ۱۰۰۰ ریال باشد",
    106: "callbackUrl نامعتبر است",
    113: "مبلغ از سقفِ تراکنش بیشتر است",
    115: "IPِ سرور در پنلِ زیبال ثبت نشده است",
}


class ZibalError(Exception):
    """
    پاسخِ ناموفق. `transient` یعنی خطا از شبکه/سرورِ زیبال است و تکرار ممکن است درست شود
    (تایم‌اوت، ۵xx، ۴۲۹)؛ در غیرِ این صورت خودِ درخواست رد شده و `result` کدِ زیبال است.
    """

    def __init__(self, message: str, *, transient: bool = False, result: int | None = None,
                 data: dict | None = None):
        super().__init__(message)
        self.message = message
        self.transient = transient
        self.result = result
        self.data = data or {}


def _post(path: str, payload: dict, *, ok: tuple[int, ...] = (RESULT_OK,)) -> dict:
    if not settings.ZIBAL_MERCHANT:
        raise ZibalError("کدِ پذیرنده‌ی زیبال تنظیم نشده است.")
    url = settings.ZIBAL_BASE_URL.rstrip("/") + path
    try:
        response = requests.post(url, json={"merchant": settings.ZIBAL_MERCHANT, **payload},
                                 timeout=(CONNECT_TIMEOUT, settings.ZIBAL_TIMEOUT),
                                 headers={"Accept": "application/json"})
    except requests.RequestException as exc:
        log.warning("zibal %s: network error %s", path, exc)
        raise ZibalError("ارتباط با درگاه برقرار نشد.", transient=True) from exc
    if response.status_code >= 500 or response.status_code == 429:
        log.warning("zibal %s: HTTP %s %s", path, response.status_code, response.text[:200])
        raise ZibalError("درگاه موقتاً پاسخ نمی‌دهد.", transient=True)
    try:
        data = response.json()
    except ValueError:
        data = None
    if not isinstance(data, dict):
        raise ZibalError("پاسخِ نامعتبر از درگاه", transient=True)
    try:
        result = int(data.get("result"))
    except (TypeError, ValueError):
        raise ZibalError("پاسخِ نامعتبر از درگاه", transient=True, data=data) from None
    if result not in ok:
        message = REQUEST_RESULTS.get(result) or str(data.get("message") or "درخواست رد شد")
        raise ZibalError(message[:250], result=result, data=data)
    return data


def request(*, amount_rial: int, callback_url: str, order_id: str, description: str, mobile: str = "") -> str:
    """ساختِ جلسه‌ی پرداخت → trackId (رشته). مبلغ به ریال (کمینه‌ی زیبال ۱۰۰۰ ریال)."""
    payload = {
        "amount": int(amount_rial),
        "callbackUrl": callback_url,
        "orderId": order_id,
        "description": description[:255],
    }
    if mobile:
        payload["mobile"] = mobile
    data = _post("/v1/request", payload)
    track_id = data.get("trackId")
    if not track_id:
        raise ZibalError("درگاه شناسه‌ی پرداخت نداد.", data=data)
    return str(track_id)


def verify(track_id: str) -> dict:
    """
    تأییدِ نهایی. `result` ۱۰۰ (همین حالا تأیید شد) یا ۲۰۱ (پیش‌تر تأیید شده بود) برمی‌گردد؛
    ۲۰۲ (پرداخت نشده) و ۲۰۳ (شناسه‌ی نامعتبر) ZibalError با همان `result` است.
    """
    return _post("/v1/verify", {"trackId": int(track_id)}, ok=(RESULT_OK, RESULT_ALREADY_VERIFIED))


def inquiry(track_id: str) -> dict:
    """وضعیتِ کاملِ یک جلسه‌ی پرداخت (`status`: جدولِ STATUS_MESSAGES)."""
    return _post("/v1/inquiry", {"trackId": int(track_id)})


def status_message(status) -> str:
    try:
        return STATUS_MESSAGES.get(int(status), "پرداخت انجام نشد")
    except (TypeError, ValueError):
        return "پرداخت انجام نشد"


def pay_url(track_id: str) -> str:
    return settings.ZIBAL_BASE_URL.rstrip("/") + f"/start/{track_id}"
