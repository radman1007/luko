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

from apps.common.sms import SmsError, send_verification_code

log = logging.getLogger("luko.otp")

OTP_TTL = 120          # ثانیه‌ی اعتبارِ کد
OTP_RESEND = 60        # فاصله‌ی مجاز تا ارسال مجدد
OTP_MAX_ATTEMPTS = 5   # سقفِ تلاشِ اشتباه برای هر کد
OTP_LENGTH = 5
# هر پیامک هزینه دارد و این مسیر عمومی است؛ سقفِ درخواست برای هر IP
OTP_IP_MAX = 12
OTP_IP_WINDOW = 3600


class OTPRateLimited(Exception):
    """درخواستِ مجددِ زودهنگام؛ arg[0] = ثانیه تا ارسالِ بعدی."""


class OTPIPBlocked(Exception):
    """سقفِ درخواستِ یک IP پر شده؛ arg[0] = ثانیه تا باز شدن."""


class OTPTooManyAttempts(Exception):
    """تعدادِ تلاشِ اشتباه بیش از حد."""


def _conn():
    return get_redis_connection("default")


def _code_key(phone: str) -> str: return f"otp:code:{phone}"
def _resend_key(phone: str) -> str: return f"otp:resend:{phone}"
def _att_key(phone: str) -> str: return f"otp:att:{phone}"


def _ip_key(ip: str) -> str: return f"otp:ip:{ip}"


def check_ip_quota(ip: str) -> None:
    """جلوی خالی‌کردنِ اعتبارِ پیامک با درخواستِ انبوه از یک IP را می‌گیرد."""
    if not ip:
        return
    r = _conn()
    key = _ip_key(ip)
    count = r.incr(key)
    if count == 1:
        r.expire(key, OTP_IP_WINDOW)
    if count > OTP_IP_MAX:
        log.warning("سقفِ OTP برای IP %s پر شد (%s درخواست)", ip, count)
        raise OTPIPBlocked(r.ttl(key))


def _as_str(value) -> str | None:
    if value is None:
        return None
    return value.decode() if isinstance(value, bytes) else str(value)


def request_otp(phone: str) -> dict:
    """
    پیامکِ کدِ تأیید را می‌فرستد و **کدی که واقعاً رفته** را ذخیره می‌کند.

    بعضی ارائه‌دهنده‌ها (ملی‌پیامک) خودشان کد را می‌سازند، پس کدِ ما فقط یک
    پیشنهاد است و مرجع، خروجیِ ارسال است. به همین دلیل اول می‌فرستیم و بعد
    ذخیره می‌کنیم؛ برعکسش یعنی ممکن بود کدی ذخیره شود که هرگز ارسال نشده.

    قفلِ ارسالِ مجدد قبل از فرستادن گرفته می‌شود تا دو درخواستِ هم‌زمان دو
    پیامک نفرستند، و اگر ارسال شکست خورد پس گرفته می‌شود تا کاربر بی‌خود
    ۶۰ ثانیه منتظر نماند.
    """
    r = _conn()
    remaining = r.ttl(_resend_key(phone))
    if remaining and remaining > 0:
        raise OTPRateLimited(remaining)

    r.setex(_resend_key(phone), OTP_RESEND, "1")
    proposed = "".join(secrets.choice("0123456789") for _ in range(OTP_LENGTH))

    try:
        delivery = send_verification_code(phone, proposed)
    except SmsError:
        r.delete(_resend_key(phone))
        raise

    code = str(delivery.get("code") or proposed)
    r.setex(_code_key(phone), OTP_TTL, code)
    r.delete(_att_key(phone))

    return {"code": code, "length": len(code), "ttl": OTP_TTL,
            "resend_in": OTP_RESEND, "delivery": delivery}


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
