"""
گزارشِ هفتگیِ بالای خانه‌ی پنلِ والدین — چند جمله‌ی کوتاه که خودکار از آمارِ همین بچه ساخته
می‌شود. فقط نقطه‌های قوت گفته می‌شود (درسی که خوب پیش رفته، مفهومی که خوب یاد گرفته،
پیوستگی، پیشرفت نسبت به هفته‌ی پیش)؛ جزئیاتِ کامل و ضعف‌ها در «جزئیاتِ بیشتر» است.

هفته‌ای که هیچ بازی و فعالیتی ندارد متنی دعوت‌کننده می‌گیرد تا والد بچه را به بازی برگرداند.
هیچ جمله‌ای بدونِ عددِ واقعیِ پشتش ساخته نمی‌شود. بعداً مدلِ زبانی همین شکل را پر می‌کند.
"""
from __future__ import annotations

from collections import defaultdict
from collections.abc import Callable
from datetime import date

from django.utils import timezone

from apps.common.fa import MONTHS, fa_day, fa_digits, to_jalali

#: کمترین پاسخ برای این‌که درسی یا مفهومی «نقطه‌ی قوت» حساب شود (نه شانس)
MIN_ANSWERS = 3
STRONG_SUBJECT = 60
STRONG_CONCEPT = 70


def _pct(part: int, total: int) -> int:
    return round(part / total * 100) if total else 0


def period_label(start: date, end: date) -> str:
    """«۱۴ تا ۲۰ مهر» یا «۲۸ شهریور تا ۳ مهر»"""
    _, sm, sd = to_jalali(start)
    _, em, ed = to_jalali(end)
    if sm == em:
        return f"{fa_digits(sd)} تا {fa_digits(ed)} {MONTHS[em - 1]}"
    return f"{fa_digits(sd)} {MONTHS[sm - 1]} تا {fa_digits(ed)} {MONTHS[em - 1]}"


def _best(rows: dict, threshold: int):
    """(کلید، دقت، تعداد) با بیشترین دقت از میانِ ردیف‌هایی که به آستانه رسیده‌اند"""
    ranked = [(key, _pct(r["correct"], r["asked"]), r["asked"])
              for key, r in rows.items() if r["asked"] >= MIN_ANSWERS]
    ranked = [row for row in ranked if row[1] >= threshold]
    return max(ranked, key=lambda row: (row[1], row[2])) if ranked else None


def _any(_: str) -> bool:
    return True


def build_weekly(*, name: str, week_answers, week_sessions, prev_minutes: int, week_games: int,
                 streak: int, subject_of, tags: dict, week_start: date, today: date,
                 last_activity: date | None, subject_ok: Callable[[str], bool] = _any,
                 concept_ok: Callable[[str], bool] = _any) -> dict:
    """
    ورودی‌ها همان‌هایی‌اند که گزارشِ والد از قبل حساب کرده (services._build_child_report).
    خروجی: {active, period, title, body, highlights, cta}

    `subject_ok` / `concept_ok` نسخه‌ی پلنِ رایگان را می‌سازند: نقطه‌ی قوت فقط از درس‌های باز
    گفته می‌شود و درسِ قفل فقط با یک جمله‌ی «با اشتراک باز می‌شود» (gating.py).
    """
    period = period_label(week_start, today)
    minutes = round(sum(e.duration_ms or 0 for e in week_sessions) / 60000)
    active = bool(week_answers or week_sessions or week_games)

    if not active:
        if last_activity:
            body = (f"آخرین بار {fa_day(last_activity, today)} بازی کرده بود. یک بازیِ کوتاه برای امروزش "
                    f"انتخاب کنید؛ روزی ده دقیقه کافی است تا مسیرش در لوکو ادامه پیدا کند.")
        else:
            body = (f"{name} هنوز اولین بازی‌اش را در لوکو انجام نداده است. با «بازیِ امروز» شروعِ ماجرا را "
                    f"برایش جذاب کنید؛ هر بازی فقط چند دقیقه است و بعدش جایزه می‌گیرد.")
        return {
            "active": False,
            "period": period,
            "title": f"این هفته هنوز فعالیتی از {name} ثبت نشده",
            "body": body,
            "highlights": [],
            "cta": "daily",
        }

    by_subject: dict = defaultdict(lambda: {"asked": 0, "correct": 0})
    by_concept: dict = defaultdict(lambda: {"asked": 0, "correct": 0})
    hidden = 0
    for event in week_answers:
        ok = 1 if event.is_correct else 0
        subject = subject_of(event.game_slug)
        if not subject_ok(subject):
            hidden += 1
            continue
        by_subject[subject]["asked"] += 1
        by_subject[subject]["correct"] += ok
        if event.concept_tag in tags and concept_ok(event.concept_tag):
            by_concept[event.concept_tag]["asked"] += 1
            by_concept[event.concept_tag]["correct"] += ok
    best_subject = _best({k: v for k, v in by_subject.items() if k != "عمومی"}, STRONG_SUBJECT)
    best_concept = _best(by_concept, STRONG_CONCEPT)

    sentences = []
    parts = []
    if week_games:
        parts.append(f"{fa_digits(week_games)} بازی را کامل کرد")
    if minutes:
        parts.append(f"{fa_digits(minutes)} دقیقه با لوکو یاد گرفت")
    if parts:
        sentences.append(f"{name} این هفته " + " و ".join(parts) + ".")
    else:
        sentences.append(f"{name} این هفته به لوکو سر زد و بازی را شروع کرد.")
    if best_subject:
        subject, accuracy, _ = best_subject
        sentences.append(f"بهترین عملکردش در درسِ «{subject}» بود؛ {fa_digits(accuracy)}٪ از پاسخ‌هایش درست بود.")
    if best_concept:
        concept = tags[best_concept[0]].title
        sentences.append(f"«{concept}» را خیلی خوب یاد گرفته است.")
    if prev_minutes and minutes >= prev_minutes * 2:
        # «۶۸۳٪ بیشتر» برای والد گنگ است؛ چند برابر روشن‌تر است
        sentences.append(f"{fa_digits(round(minutes / prev_minutes))} برابرِ هفته‌ی پیش وقت گذاشت.")
    elif prev_minutes and minutes >= prev_minutes * 1.15:
        more = round((minutes - prev_minutes) / prev_minutes * 100)
        sentences.append(f"نسبت به هفته‌ی پیش {fa_digits(more)}٪ بیشتر وقت گذاشت.")
    if streak >= 2:
        sentences.append(f"{fa_digits(streak)} روزِ پشتِ‌سرِ هم بازی کرده؛ این پیوستگی ارزشمند است.")
    if len(sentences) == 1:
        sentences.append("همین شروع یعنی قدمِ اول برداشته شده؛ تشویقش کنید که ادامه دهد.")
    if hidden:
        sentences.append("در درس‌های دیگر هم تمرین کرد؛ گزارشِ آن درس‌ها با اشتراک باز می‌شود.")

    if streak >= 3:
        title = f"{name} {fa_digits(streak)} روزِ پشتِ‌سرِ هم یاد گرفت"
    elif best_subject:
        title = f"هفته‌ی درخشانِ {name} در {best_subject[0]}"
    elif best_concept:
        title = f"{name} «{tags[best_concept[0]].title}» را خوب یاد گرفت"
    else:
        # جمله‌ی اولِ متن همین عددها را می‌گوید؛ عنوان تکرارش نمی‌کند
        title = f"شروعِ خوبِ {name} در این هفته"

    # «۱ روزِ پیاپی» چیزی نمی‌گوید؛ روزهای فعالِ هفته همیشه معنا دارد
    days = len({timezone.localtime(e.occurred_at).date() for e in [*week_answers, *week_sessions]})
    highlights = [item for item in (
        {"key": "games", "label": "بازیِ کامل‌شده", "value": week_games},
        {"key": "minutes", "label": "دقیقه یادگیری", "value": minutes},
        {"key": "days", "label": "روزِ فعال از ۷", "value": days},
    ) if item["value"]]
    return {
        "active": True,
        "period": period,
        "title": title,
        "body": " ".join(sentences),
        "highlights": highlights,
        "cta": "details",
    }
