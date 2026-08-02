"""
رمزِ یکبارمصرف (OTP) با Redis.

از اتصالِ خامِ Redis استفاده می‌کنیم (نه cacheِ IGNORE_EXCEPTIONS) تا:
- انقضای اتمیک با setex،
- شمارشِ اتمیک تلاش‌ها با incr،
- و باقی‌مانده‌ی زمان با ttl
دقیق باشند. کلیدها: otp:code / otp:resend / otp:att.
"""
from __future__ import annotations

import logging
import secrets

from django_redis import get_redis_connection

log = logging.getLogger("luko.otp")

OTP_TTL = 120          # ثانیه‌ی اعتبارِ کد
OTP_RESEND = 60        # فاصله‌ی مجاز تا ارسال مجدد
OTP_MAX_ATTEMPTS = 5   # سقفِ تلاشِ اشتباه برای هر کد
OTP_LENGTH = 5


class OTPRateLimited(Exception):
    """درخواستِ مجددِ زودهنگام؛ arg[0] = ثانیه تا ارسالِ بعدی."""


class OTPTooManyAttempts(Exception):
    """تعدادِ تلاشِ اشتباه بیش از حد."""


def _conn():
    return get_redis_connection("default")


def _code_key(phone: str) -> str: return f"otp:code:{phone}"
def _resend_key(phone: str) -> str: return f"otp:resend:{phone}"
def _att_key(phone: str) -> str: return f"otp:att:{phone}"


def _as_str(value) -> str | None:
    if value is None:
        return None
    return value.decode() if isinstance(value, bytes) else str(value)


def request_otp(phone: str) -> dict:
    """کدِ تازه می‌سازد و ذخیره می‌کند. اگر خیلی زود دوباره خواسته شد، خطا می‌دهد."""
    r = _conn()
    remaining = r.ttl(_resend_key(phone))
    if remaining and remaining > 0:
        raise OTPRateLimited(remaining)

    code = "".join(secrets.choice("0123456789") for _ in range(OTP_LENGTH))
    r.setex(_code_key(phone), OTP_TTL, code)
    r.setex(_resend_key(phone), OTP_RESEND, "1")
    r.delete(_att_key(phone))
    _send_sms(phone, code)
    return {"code": code, "ttl": OTP_TTL, "resend_in": OTP_RESEND}


def verify_otp(phone: str, code: str) -> bool:
    """کد را چک می‌کند؛ درست بود پاکش می‌کند. تلاشِ زیاد → استثنا."""
    r = _conn()
    stored = _as_str(r.get(_code_key(phone)))
    if stored is None:
        return False  # منقضی یا اصلاً درخواست‌نشده

    attempts = r.incr(_att_key(phone))
    if attempts == 1:
        r.expire(_att_key(phone), OTP_TTL)
    if attempts > OTP_MAX_ATTEMPTS:
        r.delete(_code_key(phone), _att_key(phone))
        raise OTPTooManyAttempts()

    if stored != str(code).strip():
        return False

    r.delete(_code_key(phone), _att_key(phone), _resend_key(phone))
    return True


def _send_sms(phone: str, code: str) -> None:
    # TODO: اتصال به سرویسِ پیامک (کاوه‌نگار/قاصدک/...). فعلاً فقط log می‌شود.
    log.info("OTP برای %s: %s", phone, code)
