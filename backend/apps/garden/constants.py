"""ثابت‌ها و منطقِ فصلِ باغچه — آینه‌ی frontend/features/garden/gardenData.ts."""
from __future__ import annotations

from datetime import datetime

DEW_REWARD = {"time": 2, "game": 6, "mission": 3, "medal": 15}

WATER = {
    "refill_seconds": 20 * 60,   # هر ۲۰ دقیقه یک شارژِ آب
    "base_max": 5,
    "per_plot_level": 2,
}

CARE_PER_STAGE = 4
MAX_STAGE = 5
WATER_CARE = 1
FERT_CARE = 3

SLOTS_BASE = 3
SLOTS_PER_LEVEL = 1
MAX_PLOT_LEVEL = 4

PLANT_KINDS = ["sunflower", "tulip", "tomato", "sapling", "clover"]

DEW_LOG_MAX = 20


# ---------- فصل (تقویمی واقعی) ----------
# باغچه هر فصل ریست و با تمِ همان فصل بالا می‌آید.
SEASONS = ["spring", "summer", "autumn", "winter"]
SEASON_LABELS = {"spring": "بهار", "summer": "تابستان", "autumn": "پاییز", "winter": "زمستان"}


def season_of(now: datetime) -> str:
    """فصلِ تقویمی را از ماه/روزِ میلادی حساب می‌کند (تقریبِ فصولِ شمالی)."""
    m, d = now.month, now.day
    if (m == 3 and d >= 21) or m in (4, 5) or (m == 6 and d <= 20):
        return "spring"
    if (m == 6 and d >= 21) or m in (7, 8) or (m == 9 and d <= 22):
        return "summer"
    if (m == 9 and d >= 23) or m in (10, 11) or (m == 12 and d <= 20):
        return "autumn"
    return "winter"


def season_bounds(now: datetime) -> tuple[datetime, datetime]:
    """تاریخِ شروع و پایانِ تقریبیِ فصلِ جاری (برای درصدِ پیشرفتِ فصل)."""
    year = now.year
    starts = {
        "spring": datetime(year, 3, 21, tzinfo=now.tzinfo),
        "summer": datetime(year, 6, 21, tzinfo=now.tzinfo),
        "autumn": datetime(year, 9, 23, tzinfo=now.tzinfo),
        "winter": datetime(year, 12, 21, tzinfo=now.tzinfo),
    }
    season = season_of(now)
    start = starts[season]
    if season == "winter" and now.month < 3:
        start = datetime(year - 1, 12, 21, tzinfo=now.tzinfo)
    # پایان ≈ شروعِ فصلِ بعد
    nxt = SEASONS[(SEASONS.index(season) + 1) % 4]
    end = starts.get(nxt)
    if end is None or end <= start:
        end = datetime(start.year + 1, 3, 21, tzinfo=now.tzinfo)
    return start, end


def season_progress(now: datetime) -> float:
    start, end = season_bounds(now)
    total = (end - start).total_seconds() or 1
    return max(0.0, min(1.0, (now - start).total_seconds() / total))
