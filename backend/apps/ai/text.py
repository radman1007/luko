"""
ابزارهای متنیِ بی‌وابستگی برای خروجیِ مدل‌ها: بیرون‌کشیدنِ JSON، یکدست‌کردنِ فارسی و ارقام،
پیدا کردنِ عددها برای «هیچ عددی ساختگی نباشد». جنگو لازم ندارد تا روی سرور هم آزموده شود.
"""
from __future__ import annotations

import json
import re

FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹"
AR_DIGITS = "٠١٢٣٤٥٦٧٨٩"
_TO_LATIN = {ord(c): str(i) for i, c in enumerate(FA_DIGITS)} | {ord(c): str(i) for i, c in enumerate(AR_DIGITS)}
_TO_FA = {ord(str(i)): c for i, c in enumerate(FA_DIGITS)}

#: جای نامِ بچه در متن؛ نام هیچ‌وقت به مدل فرستاده نمی‌شود
NAME_TOKEN = "[نام]"

_EMOJI = re.compile(
    "[\U0001F000-\U0001FAFF\U00002600-\U000027BF\U0001F900-\U0001F9FF⭐⭕⏩-⏺️]"
)
_NUMBER = re.compile(r"\d+(?:[.,٫]\d+)?")


def to_latin(text: str) -> str:
    return text.translate(_TO_LATIN)


def to_fa_digits(text: str) -> str:
    return text.translate(_TO_FA)


def extract_json(raw: str) -> dict | None:
    """
    شیءِ JSON از پاسخِ مدل. مدل‌ها گاهی متن را در ```json می‌پیچند یا پیش و پسش جمله‌ای
    می‌نویسند؛ از اولین «{» تا آخرین «}» را می‌خوانیم.
    """
    if not raw:
        return None
    text = raw.strip()
    fence = re.search(r"```(?:json)?\s*(\{.*\})\s*```", text, re.S)
    if fence:
        text = fence.group(1)
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end <= start:
        return None
    try:
        data = json.loads(text[start:end + 1])
    except ValueError:
        return None
    return data if isinstance(data, dict) else None


def clean(text: str) -> str:
    """
    یکدست‌کردنِ متنِ فارسی برای نمایش: «ي/ك» عربی، ارقام، علامت‌های مارک‌داون، ایموجی و فاصله‌های اضافه.
    """
    if not isinstance(text, str):
        return ""
    out = text.replace("ي", "ی").replace("ك", "ک").replace("‏", "").replace("‎", "")
    out = _EMOJI.sub("", out)
    out = re.sub(r"\*\*|__|`+", "", out)
    # خطِ تیره‌ی بلند میانِ جمله در پنل نمی‌آید (۲۶ مهر ۱۴۰۵، خواستِ کاربر): سرِ سطر حذف، میانِ متن «،»
    out = re.sub(r"(?m)^[ \t]*—[ \t]*", "", out)
    out = re.sub(r"[ \t]*—[ \t]*", "، ", out)
    out = re.sub(r"،(\s*،)+", "،", out)
    out = re.sub(r"(?m)^\s{0,3}#{1,6}\s*", "", out)
    out = re.sub(r"[ \t]+", " ", out)
    out = re.sub(r"\n{3,}", "\n\n", out)
    out = to_fa_digits(out.replace("%", "٪"))
    return out.strip()


def numbers_in(text: str) -> list[str]:
    """همه‌ی عددهای متن، با ارقامِ لاتین و ممیزِ «.» (۹٫۲ و 9.2 یکی‌اند)"""
    latin = to_latin(text).replace("٫", ".")
    return [n.replace(",", ".") for n in _NUMBER.findall(latin)]


def collect_numbers(value, out: set[str] | None = None) -> set[str]:
    """همه‌ی عددهای یک ساختارِ داده (برای مجموعه‌ی عددهای مجاز)"""
    out = set() if out is None else out
    if isinstance(value, bool):
        return out
    if isinstance(value, (int, float)):
        out.add(_norm_number(str(value)))
    elif isinstance(value, str):
        out.update(_norm_number(n) for n in numbers_in(value))
    elif isinstance(value, dict):
        for item in value.values():
            collect_numbers(item, out)
    elif isinstance(value, (list, tuple)):
        for item in value:
            collect_numbers(item, out)
    return out


def _norm_number(raw: str) -> str:
    """«9.0» و «9» یکی‌اند؛ «09» همان «9»"""
    try:
        number = float(raw)
    except ValueError:
        return raw
    return str(int(number)) if number == int(number) else str(round(number, 1))


def has_latin_words(text: str) -> bool:
    """متنِ فارسی نباید کلمه‌ی انگلیسی داشته باشد (نامِ مدل، اصطلاحِ فنی، JSON نیمه‌کاره)"""
    return bool(re.search(r"[A-Za-z]{3,}", text))
