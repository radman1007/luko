"""
کمک‌تابع‌های فارسی‌سازی برای متن‌هایی که مستقیم به کاربر نشان داده می‌شوند.

پنل والدین و صفحه‌های بچه‌ها هر دو فارسی‌اند؛ تاریخ میلادی و رقم لاتین در آن‌ها
غریبه است. این ماژول بدون هیچ وابستگی‌ی بیرونی تبدیل شمسی و ارقام را انجام می‌دهد.
"""

from __future__ import annotations

from datetime import date, datetime

_FA_DIGITS = str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹")

MONTHS = (
    "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
    "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
)

_G_DAYS_IN_MONTH = (0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334)


def fa_digits(value) -> str:
    """هر رشته یا عددی را با ارقام فارسی برمی‌گرداند."""
    return str(value).translate(_FA_DIGITS)


def to_jalali(value: date) -> tuple[int, int, int]:
    """میلادی → (سال، ماه، روز) شمسی."""
    gy, gm, gd = value.year, value.month, value.day
    if gy > 1600:
        jy = 979
        gy -= 1600
    else:
        jy = 0
        gy -= 621

    gy2 = gy + 1 if gm > 2 else gy
    days = (
        365 * gy
        + (gy2 + 3) // 4
        - (gy2 + 99) // 100
        + (gy2 + 399) // 400
        - 80
        + gd
        + _G_DAYS_IN_MONTH[gm - 1]
    )

    jy += 33 * (days // 12053)
    days %= 12053
    jy += 4 * (days // 1461)
    days %= 1461
    if days > 365:
        jy += (days - 1) // 365
        days = (days - 1) % 365

    if days < 186:
        jm = 1 + days // 31
        jd = 1 + days % 31
    else:
        jm = 7 + (days - 186) // 30
        jd = 1 + (days - 186) % 30

    return jy, jm, jd


def from_jalali(jy: int, jm: int, jd: int) -> date:
    """(سال، ماه، روزِ) شمسی → تاریخِ میلادی. اعتبارِ ماه و روز را خودش می‌سنجد."""
    if not (1 <= jm <= 12) or not (1 <= jd <= (31 if jm <= 6 else 30 if jm <= 11 else 30)):
        raise ValueError("تاریخِ شمسیِ نامعتبر")
    jy += 1595
    days = -355668 + 365 * jy + (jy // 33) * 8 + ((jy % 33) + 3) // 4 + jd
    days += (jm - 1) * 31 if jm < 7 else (jm - 7) * 30 + 186
    gy = 400 * (days // 146097)
    days %= 146097
    if days > 36524:
        days -= 1
        gy += 100 * (days // 36524)
        days %= 36524
        if days >= 365:
            days += 1
    gy += 4 * (days // 1461)
    days %= 1461
    if days > 365:
        gy += (days - 1) // 365
        days = (days - 1) % 365
    gd = days + 1
    leap = (gy % 4 == 0 and gy % 100 != 0) or gy % 400 == 0
    months = (31, 29 if leap else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31)
    gm = 0
    while gm < 12 and gd > months[gm]:
        gd -= months[gm]
        gm += 1
    result = date(gy, gm + 1, gd)
    if to_jalali(result) != (jy - 1595, jm, jd):     # مثلاً ۳۰ اسفندِ سالِ غیرکبیسه
        raise ValueError("تاریخِ شمسیِ نامعتبر")
    return result


_LATIN = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")


def parse_jalali(text: str) -> date | None:
    """«۱۴۰۵/۰۷/۱۲» یا «1405-7-12» → تاریخِ میلادی؛ نامعتبر → None."""
    import re

    match = re.fullmatch(r"\s*(\d{4})\s*[/\-.]\s*(\d{1,2})\s*[/\-.]\s*(\d{1,2})\s*", str(text or "").translate(_LATIN))
    if not match:
        return None
    try:
        return from_jalali(*(int(g) for g in match.groups()))
    except ValueError:
        return None


def fa_date(value: date, *, with_year: bool = False) -> str:
    """«۲۴ مرداد» — و با `with_year` می‌شود «۲۴ مرداد ۱۴۰۵»."""
    jy, jm, jd = to_jalali(value)
    out = f"{jd} {MONTHS[jm - 1]}"
    if with_year:
        out = f"{out} {jy}"
    return fa_digits(out)


def fa_time(value: datetime) -> str:
    """«۱۸:۳۷»"""
    return fa_digits(value.strftime("%H:%M"))


def fa_day(value: date, today: date | None = None) -> str:
    """فقط روز، بدون ساعت: «امروز» / «دیروز» / «۳ روز پیش» / «۲۴ مرداد»."""
    today = today or date.today()
    delta = (today - value).days
    if delta == 0:
        return "امروز"
    if delta == 1:
        return "دیروز"
    if 2 <= delta <= 6:
        return f"{fa_digits(delta)} روز پیش"
    return fa_date(value, with_year=delta > 300)


def fa_when(value: datetime, today: date | None = None) -> str:
    """
    تاریخِ خوانا برای والد: «امروز، ۱۸:۳۷» / «دیروز، ۰۹:۱۲» / «۲۴ مرداد، ۱۸:۳۷».

    `today` را تست‌ها و سرویس‌ها می‌دهند تا وابسته به لحظه‌ی اجرا نباشد.
    """
    today = today or date.today()
    delta = (today - value.date()).days
    stamp = fa_time(value)
    if delta == 0:
        return f"امروز، {stamp}"
    if delta == 1:
        return f"دیروز، {stamp}"
    if 2 <= delta <= 6:
        return f"{fa_digits(delta)} روز پیش، {stamp}"
    return f"{fa_date(value.date(), with_year=delta > 300)}، {stamp}"
