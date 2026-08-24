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
