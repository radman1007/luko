"""
درگاهِ پرداختِ وندار (IPG نسخه‌ی ۴). https://docs.vandar.io/ipg_service/ipg/send

    send         POST /api/v4/send         {api_key, amount(ریال), callback_url, ...} → {status: 1, token}
    پرداخت       GET  /v4/<token>           (مرورگرِ والد؛ Referer باید دامنه‌ی ثبت‌شده باشد)
    بازگشت       GET  callback_url?token=…&payment_status=OK|FAILED
    verify       POST /api/v4/verify       {api_key, token} → {status: 1, amount, transId, cardNumber, …}
    transaction  POST /api/v4/transaction  {api_key, token} → {code: 0..4, amount, transId, …}

دو نکته‌ی مهم از مستندات:
  - verify «فقط و فقط یک بار» برای هر تراکنش پاسخ می‌دهد؛ اگر پاسخش گم شود، بارِ
    دوم خطا می‌گیرد. آن‌وقت `transaction` با code=2 («تأیید شده») راهِ فهمیدن است.
  - تأیید تا ۲۰ دقیقه بعد از رفتن به درگاه شدنی است؛ بعد از آن پول به خریدار برمی‌گردد.

کلید فقط از متغیرِ محیطیِ VANDAR_API_KEY خوانده می‌شود؛ هرگز در کد یا گیت نیاید.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass

import requests
from django.conf import settings

log = logging.getLogger("luko.billing")

#: کدِ `transaction`
CODE_WRONG, CODE_AWAITING, CODE_CONFIRMED, CODE_EXPIRED, CODE_FAILED = 0, 1, 2, 3, 4


class VandarError(Exception):
    """
    پاسخِ ناموفق. `transient` یعنی خطا از شبکه/سرورِ وندار است و تکرار ممکن
    است درست شود (تایم‌اوت، ۵xx، ۴۲۹)؛ در غیرِ این صورت خودِ درخواست رد شده.
    """

    def __init__(self, message: str, *, transient: bool = False, code: str = "", data: dict | None = None):
        super().__init__(message)
        self.message = message
        self.transient = transient
        self.code = code
        self.data = data or {}


@dataclass
class Result:
    ok: bool
    data: dict


def _message(data: dict) -> str:
    errors = data.get("errors")
    if isinstance(errors, list) and errors:
        return "، ".join(str(e) for e in errors)[:250]
    if isinstance(errors, dict) and errors:
        return "، ".join(str(v[0] if isinstance(v, list) else v) for v in errors.values())[:250]
    return str(data.get("message") or "پاسخِ نامعتبر از درگاه")[:250]


def _post(path: str, payload: dict) -> dict:
    if not settings.VANDAR_API_KEY:
        raise VandarError("کلیدِ درگاهِ پرداخت تنظیم نشده است.")
    url = settings.VANDAR_BASE_URL.rstrip("/") + path
    try:
        response = requests.post(url, json={"api_key": settings.VANDAR_API_KEY, **payload},
                                 timeout=settings.VANDAR_TIMEOUT,
                                 headers={"Accept": "application/json"})
    except requests.RequestException as exc:
        log.warning("vandar %s: network error %s", path, exc)
        raise VandarError("ارتباط با درگاه برقرار نشد.", transient=True) from exc
    try:
        data = response.json()
    except ValueError:
        data = {}
    if response.status_code >= 500 or response.status_code == 429:
        log.warning("vandar %s: HTTP %s %s", path, response.status_code, response.text[:200])
        raise VandarError("درگاه موقتاً پاسخ نمی‌دهد.", transient=True, data=data)
    if not isinstance(data, dict):
        raise VandarError("پاسخِ نامعتبر از درگاه", transient=True)
    if response.status_code != 200 or str(data.get("status")) != "1":
        # verify و transaction هم وقتی چیزی برای تأیید نیست ۴۲۲ و status=0 می‌دهند
        raise VandarError(_message(data), code=str(data.get("code") or ""), data=data)
    return data


def send(*, amount_rial: int, callback_url: str, factor_number: str, description: str,
         mobile: str = "") -> str:
    """ساختِ تراکنش → توکن. مبلغ به ریال (کمینه‌ی وندار ۱۰۰۰ ریال)."""
    payload = {
        "amount": int(amount_rial),
        "callback_url": callback_url,
        "factorNumber": factor_number,
        "description": description[:255],
    }
    if mobile:
        payload["mobile_number"] = mobile
    data = _post("/api/v4/send", payload)
    token = data.get("token")
    if not token:
        raise VandarError("درگاه توکن نداد.", data=data)
    return str(token)


def verify(token: str) -> dict:
    """تأییدِ نهایی (فقط یک‌بار جواب می‌دهد)."""
    return _post("/api/v4/verify", {"token": token})


def transaction(token: str) -> dict:
    """وضعیتِ تراکنش (`code`: ۰ نادرست، ۱ منتظرِ تأیید، ۲ تأییدشده، ۳ منقضی، ۴ ناموفق)."""
    try:
        return _post("/api/v4/transaction", {"token": token})
    except VandarError as exc:
        # برای تراکنشِ ناموفق/منقضی هم `code` در پاسخِ ۴۲۲ می‌آید
        if not exc.transient and "code" in exc.data and isinstance(exc.data.get("code"), int):
            return exc.data
        raise


def pay_url(token: str) -> str:
    return settings.VANDAR_BASE_URL.rstrip("/") + f"/v4/{token}"
