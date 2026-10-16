"""
کلاینتِ گیت‌وی AIaaSِ آروان‌کلاد (docs.arvancloud.ir/fa/aiaas).

- سازگار با OpenAI: POST {AI_BASE_URL}/chat/completions، سرآیندِ «Authorization: apikey <کلید>».
- همه‌چیز در *یک* پیامِ کاربر می‌رود: گیت‌وی پیامِ system را برای DeepSeek-V4-Flash نادیده می‌گیرد.
- گیت‌وی حافظه ندارد و داده‌ای نگه نمی‌دارد؛ هر درخواست مستقل است.
- DeepSeek-V4-Pro پیش از پاسخ «استدلال» می‌کند و همان از max_tokens کم می‌شود؛ سقفش بالاتر است.
- هر درخواست (موفق یا نه) در AIUsage ثبت می‌شود: مصرفِ توکن و سهمیه‌ی روزانه از همین است.
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass

import requests
from django.conf import settings

from .models import AIUsage

log = logging.getLogger(__name__)

#: سطح‌ها از دیدِ والد، به همین ترتیب در پنل. `premium` یعنی فقط با اشتراکِ همان فرزند. نامِ مدل به والد نشان داده
#: نمی‌شود (۲۵ مهر ۱۴۰۵، به خواستِ کاربر: «لوکو سریع/همراه/بینش»)
TIERS = {
    "flash": {"label": "لوکو سریع", "note": "پاسخ‌های سریع و کاربردی برای سؤال‌های روزمره",
              "name": "DeepSeek V4 Flash", "premium": False},
    "luna": {"label": "لوکو همراه", "note": "راهنمایی دقیق‌تر و پیشنهادهای عملی برای همراهی با فرزندت",
             "name": "GPT-5.6 Luna", "premium": True},
    "pro": {"label": "لوکو بینش", "note": "بررسی عمیق‌تر موضوعات پیچیده و ارائه‌ی پیشنهادهای چندجانبه",
            "name": "DeepSeek V4 Pro", "premium": True},
}

#: سقفِ توکنِ خروجی برای هر کار؛ Pro جای استدلال هم لازم دارد (آزمونِ ۲۲ مهر: تا ۴۱۰۰ توکن)
MAX_TOKENS = {
    "insight": {"flash": 3000, "pro": 10000, "luna": 3000},
    "assistant": {"flash": 1000, "pro": 6000, "luna": 1000},
    "painting": {"flash": 900, "pro": 6000, "luna": 900},
}

RETRY_STATUS = {429, 500, 502, 503, 504}

#: پارامترهای اضافه‌ی هر سطح. از ۲۳ مهر ۱۴۰۵ گیت‌وی برای Flash هم «استدلال» روشن کرد: کلِ max_tokens صرفِ
#: استدلالِ پنهان می‌شد و متن خالی برمی‌گشت (تحلیل و دستیارِ رایگان «پاسخ نرسید»). thinking=disabled آن را خاموش
#: می‌کند (آزمونِ ۲۴ مهر: استدلال ۰، پاسخ در ۴ ثانیه). Pro عمداً استدلال می‌کند؛ Luna خودش نمی‌کند.
EXTRA_BODY = {
    "flash": {"thinking": {"type": "disabled"}},
}

#: سقفِ انتظار برای هر تلاش. گیت‌وی گاهی بارِ اول بی‌پاسخ می‌ماند (پروداکشن، ۲۲ مهر: دو تحلیل از چهار)؛ تلاشِ
#: دوم معمولاً ۲۰ ثانیه‌ای جواب می‌دهد. پاسخِ عادی: تحلیلِ Flash ۱۷ تا ۳۲، Luna ۸ تا ۱۱ ثانیه؛ Pro به‌خاطرِ
#: استدلال بلندتر و سقفش بالاتر است.
TIMEOUTS = {
    # تحلیل در صف ساخته می‌شود (والد تا آن موقع متنِ قاعده‌محور را می‌بیند)؛ Luna با برگه‌ی بزرگ‌ترِ «رشدِ چهار
    # هفته» ۳۷ تا ۷۳ ثانیه طول کشید (۲۴ مهر)، پس سقفِ تحلیل بازتر است
    "insight": {"flash": 60, "pro": 120, "luna": 90},
    "assistant": {"flash": 40, "pro": 80, "luna": 40},
    # تحلیلِ نقاشی با تصویر (آزمونِ ۲۵ مهر روی سرور: Luna ۹ ثانیه، Flash ۴ ثانیه؛ Pro تصویر را نمی‌بیند)
    "painting": {"flash": 40, "pro": 80, "luna": 60},
}


class AIError(Exception):
    """درخواست به مدل انجام نشد (خاموش، کلید، سقفِ درخواست، شبکه یا پاسخِ خالی)"""

    def __init__(self, code: str, message: str = ""):
        super().__init__(message or code)
        self.code = code


@dataclass
class Completion:
    text: str
    tier: str
    model: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    reasoning_tokens: int = 0
    latency_ms: int = 0


def enabled() -> bool:
    return bool(settings.AI_ENABLED and settings.AI_BASE_URL and settings.AI_API_KEY)


def model_of(tier: str) -> str:
    return {"flash": settings.AI_MODEL_FLASH, "pro": settings.AI_MODEL_PRO, "luna": settings.AI_MODEL_LUNA}[tier]


def _post(body: dict, timeout: int) -> requests.Response:
    return requests.post(
        f"{settings.AI_BASE_URL}/chat/completions",
        json=body,
        headers={"Authorization": f"apikey {settings.AI_API_KEY}", "Content-Type": "application/json"},
        timeout=timeout,
    )


def complete(tier: str, prompt: str, *, feature: str, temperature: float = 0.4, user=None, child=None,
             timeout: int | None = None, image: str | None = None) -> Completion:
    """
    یک پرسش به مدلِ این سطح. یک بار دوباره تلاش می‌کند (سقفِ درخواست، خطای موقتِ سرور، قطعیِ شبکه).
    `image` (data URL) کنارِ متن می‌رود؛ Luna و Flash تصویر را می‌بینند، Pro نه.
    """
    if not enabled():
        raise AIError("disabled", "هوش مصنوعی خاموش است.")
    model = model_of(tier)
    content = prompt if not image else [
        {"type": "text", "text": prompt},
        {"type": "image_url", "image_url": {"url": image}},
    ]
    body = {
        "model": model,
        "messages": [{"role": "user", "content": content}],
        "max_tokens": MAX_TOKENS[feature][tier],
        "temperature": temperature,
        **EXTRA_BODY.get(tier, {}),
    }
    started = time.monotonic()
    error = first_error = ""
    data = None
    for attempt in range(2):
        error = ""
        try:
            response = _post(body, timeout or TIMEOUTS.get(feature, {}).get(tier, settings.AI_TIMEOUT))
        except requests.RequestException as exc:
            error = f"network:{type(exc).__name__}"
        else:
            if response.status_code == 200:
                try:
                    data = response.json()
                except ValueError:
                    error = "bad-json"
                else:
                    if isinstance(data, dict):
                        break
                    data, error = None, "bad-shape"
            else:
                error = f"http:{response.status_code}"
                if response.status_code not in RETRY_STATUS:
                    break
        if attempt == 0:
            first_error = error
            time.sleep(2)

    latency = int((time.monotonic() - started) * 1000)
    usage = (data or {}).get("usage") or {}
    text = ""
    if data:
        try:
            text = (data["choices"][0]["message"].get("content") or "").strip()
        except (KeyError, IndexError, TypeError, AttributeError):
            error = "bad-shape"
        if data and not text and not error:
            # Pro اگر تا سقفِ توکن فقط استدلال کند، متنی برنمی‌گرداند
            error = "empty"
    details = usage.get("completion_tokens_details") or {}
    # موفق بعد از تلاشِ دوم هم ثبت می‌شود تا کندیِ گیت‌وی در «مصرفِ هوش مصنوعی» دیده شود
    note = error or (f"retried:{first_error}" if first_error and data else "")
    AIUsage.objects.create(
        user=user, child=child, feature=feature, tier=tier, model=model, ok=not error, error=note[:200],
        prompt_tokens=usage.get("prompt_tokens") or 0, completion_tokens=usage.get("completion_tokens") or 0,
        reasoning_tokens=details.get("reasoning_tokens") or 0, latency_ms=latency,
    )
    if error:
        log.warning("ai %s/%s failed: %s (%sms)", feature, model, error, latency)
        raise AIError(error)
    return Completion(
        text=text, tier=tier, model=model, prompt_tokens=usage.get("prompt_tokens") or 0,
        completion_tokens=usage.get("completion_tokens") or 0, reasoning_tokens=details.get("reasoning_tokens") or 0,
        latency_ms=latency,
    )
