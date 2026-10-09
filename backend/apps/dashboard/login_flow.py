"""
ورودِ دومرحله‌ای به داشبورد: رمز، بعد کدِ پیامکی.

مرحله‌ی اول فقط یک «بلیت» می‌دهد (توکنِ تصادفیِ ۳۲ بایتی در کش، ۵ دقیقه). نشستِ
داشبورد فقط با کدِ درستِ همان بلیت ساخته می‌شود. سقفِ تلاش برای هر IP، هر شماره و
هر بلیت جدا شمرده می‌شود. پیامِ خطا هیچ‌وقت نمی‌گوید «این شماره کارمند است یا نه».
"""
from __future__ import annotations

import logging
import secrets
import time

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.core.cache import cache

from apps.accounts.models import User
from apps.accounts.utils import normalize_phone
from apps.common.sms import SmsError, send_verification_code

from . import capabilities

log = logging.getLogger("luko.dashboard")

CHALLENGE_TTL = 300
RESEND_AFTER = 60
MAX_RESENDS = 3
MAX_CODE_ATTEMPTS = 5
CODE_LENGTH = 6
#: قفلِ ورود پس از این‌همه رمزِ غلط (۱۵ دقیقه)
MAX_FAILS_PER_PHONE = 5
MAX_FAILS_PER_IP = 15
LOCK_SECONDS = 15 * 60

_DUMMY_HASH = make_password("luko-dashboard-dummy-password")


class LoginError(Exception):
    def __init__(self, message: str, status: int = 400, retry_after: int | None = None):
        super().__init__(message)
        self.message, self.status, self.retry_after = message, status, retry_after


def _fails_key(kind: str, value: str) -> str:
    return f"dash:login-fail:{kind}:{value}"


def _count(key: str) -> int:
    try:
        return int(cache.get(key) or 0)
    except Exception:                                             # noqa: BLE001
        return 0


def _bump(key: str) -> int:
    try:
        if cache.add(key, 1, LOCK_SECONDS):
            return 1
        return cache.incr(key)
    except Exception:                                             # noqa: BLE001
        return 0


def _challenge_key(token: str) -> str:
    return f"dash:2fa:{token}"


def mask(phone: str) -> str:
    return f"{phone[:4]}•••{phone[-3:]}" if phone and len(phone) >= 8 else "•••"


def locked(ip: str, phone: str) -> bool:
    return (_count(_fails_key("ip", ip)) >= MAX_FAILS_PER_IP
            or (phone and _count(_fails_key("phone", phone)) >= MAX_FAILS_PER_PHONE))


def check_password_step(raw_phone: str, password: str, ip: str) -> User:
    """کاربرِ کارمندِ فعال با همین رمز، یا LoginError. شکست‌ها شمرده می‌شوند."""
    phone = normalize_phone(raw_phone) or ""
    if locked(ip, phone):
        raise LoginError("تلاشِ ناموفقِ زیادی شد؛ ۱۵ دقیقه‌ی دیگر دوباره امتحان کنید.", 429, LOCK_SECONDS)
    candidates = list(User.objects.filter(phone=phone, is_active=True, is_staff=True)) if phone else []
    user = next((u for u in candidates if u.check_password(password or "")), None)
    if not candidates:
        check_password(password or "", _DUMMY_HASH)      # زمانِ پاسخ نگوید شماره کارمند هست یا نه
    if user is None or not capabilities.of(user):
        _bump(_fails_key("ip", ip))
        if phone:
            _bump(_fails_key("phone", phone))
        raise LoginError("شماره یا رمز درست نیست.", 400)
    cache.delete_many([_fails_key("phone", phone)])
    return user


def _send(user: User) -> str:
    proposed = "".join(secrets.choice("0123456789") for _ in range(CODE_LENGTH))
    try:
        delivery = send_verification_code(user.phone, proposed)
    except SmsError as exc:
        log.warning("پیامکِ ورودِ داشبورد نرفت: %s", exc)
        raise LoginError("پیامکِ کد فرستاده نشد؛ کمی بعد دوباره تلاش کنید.", 503) from exc
    return str(delivery.get("code") or proposed)


def start_challenge(user: User, ip: str) -> dict:
    token = secrets.token_urlsafe(32)
    code = _send(user)
    state = {"uid": user.pk, "code": code, "sent": int(time.time()), "resends": 0, "attempts": 0, "ip": ip}
    cache.set(_challenge_key(token), state, CHALLENGE_TTL)
    out = {"challenge": token, "phone": mask(user.phone), "expires_in": CHALLENGE_TTL, "resend_in": RESEND_AFTER}
    if getattr(settings, "OTP_EXPOSE_DEV_CODE", False):
        out["dev_code"] = code
    return out


def resend(token: str) -> dict:
    state = cache.get(_challenge_key(token or ""))
    if not state:
        raise LoginError("کد منقضی شد؛ دوباره وارد شوید.", 400)
    wait = RESEND_AFTER - (int(time.time()) - state["sent"])
    if wait > 0:
        raise LoginError(f"تا {wait} ثانیه‌ی دیگر می‌توانید کدِ تازه بخواهید.", 429, wait)
    if state["resends"] >= MAX_RESENDS:
        raise LoginError("کدِ تازه‌ی بیشتری نمی‌شود فرستاد؛ دوباره وارد شوید.", 429)
    user = User.objects.filter(pk=state["uid"], is_active=True, is_staff=True).first()
    if user is None:
        raise LoginError("کد منقضی شد؛ دوباره وارد شوید.", 400)
    state.update(code=_send(user), sent=int(time.time()), resends=state["resends"] + 1, attempts=0)
    cache.set(_challenge_key(token), state, CHALLENGE_TTL)
    out = {"phone": mask(user.phone), "expires_in": CHALLENGE_TTL, "resend_in": RESEND_AFTER}
    if getattr(settings, "OTP_EXPOSE_DEV_CODE", False):
        out["dev_code"] = state["code"]
    return out


def verify(token: str, code: str) -> User:
    key = _challenge_key(token or "")
    state = cache.get(key)
    if not state:
        raise LoginError("کد منقضی شد؛ دوباره وارد شوید.", 400)
    state["attempts"] += 1
    if state["attempts"] > MAX_CODE_ATTEMPTS:
        cache.delete(key)
        raise LoginError("کدِ اشتباهِ زیادی وارد شد؛ دوباره وارد شوید.", 429)
    typed = "".join(ch for ch in str(code or "").translate(str.maketrans("۰۱۲۳۴۵۶۷۸۹", "0123456789")) if ch.isdigit())
    if not secrets.compare_digest(typed, str(state["code"])):
        cache.set(key, state, CHALLENGE_TTL)
        left = MAX_CODE_ATTEMPTS - state["attempts"]
        raise LoginError(f"کد درست نیست ({left} بارِ دیگر می‌توانید امتحان کنید).", 400)
    cache.delete(key)                                        # هر بلیت فقط یک‌بار
    user = User.objects.filter(pk=state["uid"], is_active=True, is_staff=True).first()
    if user is None or not capabilities.of(user):
        raise LoginError("این حساب به داشبورد دسترسی ندارد.", 403)
    return user
