"""
پذیرشِ خروجیِ مدل، بخش‌به‌بخش. بخشی که قاعده‌ای را بشکند کنار می‌رود و همان متنِ قاعده‌محور
نشان داده می‌شود؛ پس والد هیچ‌وقت عددِ ساختگی یا متنِ خراب نمی‌بیند.

قاعده‌ها: فارسی (بی‌کلمه‌ی انگلیسی)، طولِ معقول، نامِ بچه حداکثر دو بار، هر درصد و هر عددِ
بزرگ باید در داده باشد، و در پلنِ رایگان نامِ درسِ قفل نیاید. بی‌وابستگی به جنگو.
"""
from __future__ import annotations

import re

from .prompts import HEALTH_TIP_KINDS, TIP_KINDS
from .text import NAME_TOKEN, clean, collect_numbers, has_latin_words, numbers_in, to_latin

FINDING_TONES = ("good", "watch", "tip")
#: عددِ حرفی («شش روز»، «شصت‌وپنج درصد») هم مثلِ رقم سنجیده می‌شود. «یک»، «دو»، «سه» و «نه»
#: تنها نمی‌آیند: رایج‌اند («یک بازی») و «نه» یعنی «خیر»؛ فقط در عددِ ترکیبی شمرده می‌شوند.
UNITS = {"یک": 1, "دو": 2, "سه": 3, "چهار": 4, "پنج": 5, "شش": 6, "هفت": 7, "هشت": 8, "نه": 9}
TEENS = {"ده": 10, "یازده": 11, "دوازده": 12, "سیزده": 13, "چهارده": 14, "پانزده": 15, "شانزده": 16,
         "هفده": 17, "هجده": 18, "نوزده": 19}
TENS = {"بیست": 20, "سی": 30, "چهل": 40, "پنجاه": 50, "شصت": 60, "هفتاد": 70, "هشتاد": 80, "نود": 90,
        "صد": 100, "دویست": 200, "سیصد": 300}
_STANDALONE_SKIP = {"یک", "دو", "سه", "نه"}
#: نامِ روزها پیش از شمردن کنار می‌رود («پنج‌شنبه» عددِ پنج نیست)
_WEEKDAYS = re.compile(r"(?:یک|دو|سه|چهار|پنج)\u200c?\s?شنبه|شنبه|جمعه")
_JOIN = r"\s*\u200c?\s*و\s*\u200c?\s*"
_WORD_NUMBER = re.compile(
    r"(?:^|(?<=[\s\u200c«(]))(?:(?P<tens>%s)(?:%s(?P<tail>%s))?|(?P<teen>%s)|(?P<unit>%s))(?=$|[\s\u200c،.؛:!?»)])" % (
        "|".join(TENS), _JOIN, "|".join([*TEENS, *UNITS]), "|".join(TEENS), "|".join(UNITS)))
#: حال‌هایی که بی‌ابهام‌اند («آرام» و «خسته» در پیشنهادها معنای عام هم دارند)
MOOD_WORDS = {"شاد", "ناراحت", "عصبانی"}
_TOKEN_SPLIT = re.compile(r"[\s\u200c،,.؛;:!?()«»\-–—/]+")
#: عددهای کوچک در متنِ گزارشی آزاد است («۲ درس»)؛ در پیشنهاد بیشتر («روزی ۱۵ دقیقه»)
FACT_FREE_UPTO = 3
ADVICE_FREE_UPTO = 30


class Rejected(ValueError):
    pass


def _percent_numbers(text: str) -> set[str]:
    """عددهایی که درصدند («۴۵٪»، «۴۵ درصد») — این‌ها همیشه باید در داده باشند"""
    latin = to_latin(text).replace("٫", ".")
    found = re.findall(r"(\d+(?:\.\d+)?)\s*(?:٪|%|درصد)", latin)
    return {n[:-2] if n.endswith(".0") else n for n in found}


def _tokens(text: str) -> list[str]:
    return [t for t in _TOKEN_SPLIT.split(text) if t]


def word_numbers(text: str) -> list[tuple[int, bool]]:
    """
    عددهای حرفیِ متن: [(مقدار، درصد است؟)]. «شصت‌وپنج درصد» → (۶۵، بله)؛ «شش روز» → (۶، خیر).
    """
    text = _WEEKDAYS.sub(" ", text)
    out = []
    for match in _WORD_NUMBER.finditer(text):
        tens, tail, teen, unit = match.group("tens", "tail", "teen", "unit")
        if unit in _STANDALONE_SKIP:
            continue
        if tens:
            value = TENS[tens] + (TEENS.get(tail) or UNITS.get(tail, 0) if tail else 0)
        else:
            value = TEENS[teen] if teen else UNITS[unit]
        percent = bool(re.match(r"\s*(?:درصد|٪)", text[match.end():]))
        out.append((value, percent))
    return out


def check_text(text, *, max_len: int, allowed: set[str], locked: list[str], advice: bool = False,
               min_len: int = 6, moods: set[str] | None = None) -> str:
    """
    `advice`: پیشنهاد است (عددِ کوچک و عددِ حرفی آزادتر). `moods`: حال‌هایی که در داده هست؛
    اگر داده شود، نامِ حالِ دیگری در متن نمی‌آید.
    """
    out = clean(text if isinstance(text, str) else "")
    if len(out) < min_len:
        raise Rejected("empty")
    if len(out) > max_len:
        raise Rejected(f"too-long:{len(out)}")
    if has_latin_words(out):
        raise Rejected("latin")
    if out.count(NAME_TOKEN) > 2:
        raise Rejected("name-repeated")
    if "..." in out or "…" in out:
        raise Rejected("ellipsis")
    tokens = _tokens(out)
    for value, percent in word_numbers(out):
        if str(value) in allowed:
            continue
        if percent or value > (ADVICE_FREE_UPTO if advice else FACT_FREE_UPTO):
            raise Rejected(f"number-word:{value}")
    if moods is not None:
        for token in tokens:
            if token in MOOD_WORDS and token not in moods:
                raise Rejected(f"mood:{token}")
    for number in _percent_numbers(out):
        if number not in allowed:
            raise Rejected(f"percent:{number}")
    limit = ADVICE_FREE_UPTO if advice else FACT_FREE_UPTO
    for raw in numbers_in(out):
        number = raw[:-2] if raw.endswith(".0") else raw
        try:
            small = float(number) <= limit
        except ValueError:
            small = False
        if not small and number not in allowed:
            raise Rejected(f"number:{number}")
    for subject in locked:
        if subject and subject in out:
            raise Rejected(f"locked:{subject}")
    return out


def _tips(items, *, kinds: tuple[str, ...], allowed, locked, minimum: int, maximum: int) -> list[dict]:
    if not isinstance(items, list):
        raise Rejected("not-a-list")
    out = []
    for item in items:
        if not isinstance(item, dict):
            continue
        try:
            title = check_text(item.get("title"), max_len=70, allowed=allowed, locked=locked, advice=True, min_len=3)
            body = check_text(item.get("body"), max_len=300, allowed=allowed, locked=locked, advice=True, min_len=20)
        except Rejected:
            continue
        kind = item.get("kind") if item.get("kind") in kinds else kinds[0]
        out.append({"kind": kind, "title": title, "body": body})
        if len(out) >= maximum:
            break
    if len(out) < minimum:
        raise Rejected(f"too-few-tips:{len(out)}")
    return out


def validate_bundle(data: dict | None, facts: dict, sections: list[str]) -> tuple[dict, dict]:
    """
    (بخش‌های پذیرفته، {بخشِ ردشده: دلیل}). بخشی که مدل اصلاً نفرستاده هم ردشده حساب می‌شود.
    """
    # بازه‌های ثابتی که در توضیحِ داده به مدل گفته‌ایم: «۴ روز از ۷ روز»، «۸ هفته‌ی اخیر»،
    # «چهار هفته‌ی اخیر» (حالِ دقیق)، «بعد از ساعتِ ۲۱» و «پیش از ۶ صبح»
    allowed = collect_numbers(facts) | {"4", "6", "7", "8", "21", "24"}
    locked = list(facts.get("locked_subjects") or [])
    moods = set(((facts.get("mood_this_week") or {}).get("moods") or {}))
    accepted: dict = {}
    rejected: dict = {}
    data = data if isinstance(data, dict) else {}

    def run(name, fn):
        if name not in sections:
            return
        try:
            accepted[name] = fn(data.get(name))
        except Rejected as error:
            rejected[name] = str(error)
        except (AttributeError, TypeError):
            rejected[name] = "shape"

    def weekly(value):
        return {
            "title": check_text(value["title"], max_len=80, allowed=allowed, locked=locked, moods=moods),
            "body": check_text(value["body"], max_len=420, allowed=allowed, locked=locked, min_len=30, moods=moods),
        }

    def analysis(value):
        findings = []
        for item in value.get("findings") or []:
            try:
                findings.append({
                    "tone": item.get("tone") if item.get("tone") in FINDING_TONES else "tip",
                    "title": check_text(item.get("title"), max_len=70, allowed=allowed, locked=locked, min_len=3),
                    "body": check_text(item.get("body"), max_len=280, allowed=allowed, locked=locked, advice=True,
                                       min_len=20),
                })
            except (Rejected, AttributeError):
                continue
        if len(findings) < 2:
            raise Rejected(f"too-few-findings:{len(findings)}")
        action = None
        if isinstance(value.get("action"), dict):
            try:
                action = {
                    "title": check_text(value["action"].get("title"), max_len=80, allowed=allowed, locked=locked,
                                        advice=True, min_len=3),
                    "body": check_text(value["action"].get("body"), max_len=300, allowed=allowed, locked=locked,
                                       advice=True, min_len=20),
                }
            except Rejected:
                action = None
        return {
            "headline": check_text(value["headline"], max_len=90, allowed=allowed, locked=locked, moods=moods),
            "narrative": check_text(value["narrative"], max_len=480, allowed=allowed, locked=locked, min_len=30,
                                    moods=moods),
            "findings": findings[:4],
            "action": action,
        }

    def health(value):
        tips = []
        try:
            tips = _tips(value.get("tips"), kinds=HEALTH_TIP_KINDS, allowed=allowed, locked=locked, minimum=1, maximum=2)
        except Rejected:
            tips = []
        return {
            "title": check_text(value["title"], max_len=80, allowed=allowed, locked=locked, moods=moods),
            "body": check_text(value["body"], max_len=340, allowed=allowed, locked=locked, min_len=20, moods=moods),
            "tips": tips,
        }

    run("weekly", weekly)
    run("analysis", analysis)
    run("tips", lambda v: _tips(v, kinds=TIP_KINDS, allowed=allowed, locked=locked, minimum=2, maximum=4))
    run("health", health)
    run("health_daily_tips",
        lambda v: _tips(v, kinds=HEALTH_TIP_KINDS, allowed=allowed, locked=locked, minimum=2, maximum=5))
    return accepted, rejected


def clean_reply(text: str) -> str:
    """پاسخِ دستیار: همان پاک‌سازیِ متن، فهرست‌ها با «• »"""
    out = clean(text or "")
    out = re.sub(r"(?m)^\s*(?:[-*]|\d+[.)]|[۰-۹]+[.)])\s+", "• ", out)
    # بعضی مدل‌ها فهرست را در همان بند می‌نویسند: «... کمک کنید: • اول • دوم»
    out = re.sub(r"[ \t]+•[ \t]+", "\n• ", out)
    # نامِ اپ را مدلِ پایه گاهی «لولو» می‌نویسد
    out = out.replace("لولو", "لوکو")
    return out.strip()


__all__ = ["Rejected", "check_text", "validate_bundle", "clean_reply", "collect_numbers"]
