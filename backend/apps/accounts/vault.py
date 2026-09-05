"""
گاوصندوقِ رمز — برای پشتیبانیِ تلفنی.

پشتیبانی باید بتواند رمزِ کاربری که فراموشش کرده را ببیند. رمزِ خودِ
احراز هویت مثل همیشه هَش می‌شود (`User.password`) و هرگز خوانا نیست؛
این یک نسخه‌ی **رمزنگاری‌شده**ی جداست که فقط با کلیدِ سرور باز می‌شود.

چرا خوانا ذخیره نمی‌کنیم: با یک دامپِ دیتابیس، رمزِ همه‌ی والدین لو
می‌رفت — و چون مردم رمزشان را در سرویس‌های دیگر هم می‌گذارند، آسیبش از
لوکو فراتر می‌رفت. با این شکل، دیتابیسِ لو رفته به‌تنهایی چیزی نمی‌دهد.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import logging
import os

from django.conf import settings

log = logging.getLogger("luko.vault")

# نشانه‌ی نسخه، تا اگر روزی روشِ رمزنگاری عوض شد بشود تشخیص داد
PREFIX = "v1:"


def _key() -> bytes | None:
    raw = (getattr(settings, "PASSWORD_VAULT_KEY", "") or "").strip()
    if not raw:
        return None
    # کلیدِ ۳۲ بایتی از هر رشته‌ای، تا مدیرِ سرور مجبور نباشد فرمتِ خاصی بسازد
    return hashlib.sha256(raw.encode()).digest()


def _stream(key: bytes, nonce: bytes, length: int) -> bytes:
    """کلیدجریانِ ساده روی HMAC-SHA256 (بدونِ وابستگیِ بیرونی)."""
    out = bytearray()
    counter = 0
    while len(out) < length:
        out += hmac.new(key, nonce + counter.to_bytes(4, "big"), hashlib.sha256).digest()
        counter += 1
    return bytes(out[:length])


def seal(password: str) -> str:
    """رمز → متنِ رمزنگاری‌شده. کلید که نباشد، چیزی ذخیره نمی‌شود."""
    key = _key()
    if not key or not password:
        return ""
    nonce = os.urandom(12)
    data = password.encode()
    cipher = bytes(a ^ b for a, b in zip(data, _stream(key, nonce, len(data))))
    tag = hmac.new(key, nonce + cipher, hashlib.sha256).digest()[:16]
    return PREFIX + base64.urlsafe_b64encode(nonce + tag + cipher).decode()


def open_sealed(sealed: str) -> str | None:
    """متنِ رمزنگاری‌شده → رمز. `None` یعنی کلید نیست یا داده دستکاری شده."""
    key = _key()
    if not key or not sealed or not sealed.startswith(PREFIX):
        return None
    try:
        blob = base64.urlsafe_b64decode(sealed[len(PREFIX):])
        nonce, tag, cipher = blob[:12], blob[12:28], blob[28:]
        expected = hmac.new(key, nonce + cipher, hashlib.sha256).digest()[:16]
        if not hmac.compare_digest(tag, expected):
            log.warning("گاوصندوقِ رمز: امضا نخواند — داده دستکاری شده یا کلید عوض شده")
            return None
        return bytes(a ^ b for a, b in zip(cipher, _stream(key, nonce, len(cipher)))).decode()
    except Exception:                                   # noqa: BLE001
        log.warning("گاوصندوقِ رمز: بازکردن ناموفق")
        return None
