"""
لینکِ کوتاه‌عمرِ امضاشده برای فایلِ بازی.

فایل‌های بازی تا امروز کاملاً عمومی بودند: با یک `curl` و بدونِ هیچ حسابی
می‌شد هر ۲۷ بازی را دانلود کرد. حالا nginx فقط لینکی را می‌پذیرد که سرور
امضا کرده باشد، و سرور امضا را فقط برای مرحله‌ای می‌دهد که همین کاربر
واقعاً بازش کرده است. یعنی حتی یک حسابِ واقعی هم نمی‌تواند یک‌جا همه را
بردارد؛ باید مرحله‌به‌مرحله جلو برود.

قالبِ امضا همان چیزی است که ماژولِ `secure_link` نginx می‌فهمد:
    md5( "<expires><uri><secret>" ) → base64url بدونِ `=`
"""
from __future__ import annotations

import base64
import hashlib
import time

from django.conf import settings

# عمرِ لینک. باید برای بازشدنِ بازی کافی باشد و برای پخشِ آدرس کوتاه.
TTL_SECONDS = 300


def sign(path: str, ttl: int = TTL_SECONDS) -> str:
    """`/games/...html` → همان مسیر با امضا و انقضا."""
    secret = settings.GAME_LINK_SECRET
    expires = int(time.time()) + ttl
    digest = hashlib.md5(f"{expires}{path}{secret}".encode()).digest()
    token = base64.urlsafe_b64encode(digest).decode().rstrip("=")
    return f"{path}?e={expires}&k={token}"
