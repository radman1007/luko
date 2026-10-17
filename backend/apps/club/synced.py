"""
مأموریت‌ها و ورزش‌هایی که بچه در اپ انجام داده.

اپ (سایت و اندروید) مأموریت‌ها را سمتِ خودش حساب می‌کند (features/club/store.ts) و فقط با هم‌رسانیِ حساب
(apps.sync) به سرور می‌رسند؛ APIِ کلابِ سرور را صدا نمی‌زند و MissionCompletion تا ۲۵ مهر ۱۴۰۵ حتی یک ردیف
نداشت — روزهای پیاپی و ورزشِ پنلِ والد همیشه صفر بود. گزارشِ والد این‌ها را از همین داده‌ی هم‌رسان می‌خواند
(به‌علاوه‌ی MissionCompletion اگر روزی پر شد).
"""
from __future__ import annotations

import json
import re
from datetime import date

from apps.sync.models import KidData

from .models import MissionCompletion, MissionTemplate

#: روزهایی که دستِ‌کم یک مأموریت انجام شده — پایه‌ی استریکِ خودِ اپ
DAYS_KEY = "luko_club_days"
#: ورزش‌های انجام‌شده‌ی هر روز (فهرستِ شناسه‌ها)
SPORT_DONE_PREFIX = "luko_sport_done_"
SPORT_DONE_RE = re.compile(r"^luko_sport_done_(\d{4}-\d{2}-\d{2})$")


def _json_list(raw) -> list:
    try:
        value = json.loads(raw or "[]")
    except ValueError:
        return []
    return value if isinstance(value, list) else []


def mission_days(user) -> set[date]:
    """روزهایی که بچه مأموریت انجام داده."""
    days = set(MissionCompletion.objects.filter(user=user).values_list("day", flat=True))
    raw = KidData.objects.filter(user=user, key=DAYS_KEY).values_list("value", flat=True).first()
    for item in _json_list(raw):
        try:
            days.add(date.fromisoformat(str(item)))
        except ValueError:
            continue
    return days


def sport_count(user, since: date) -> int:
    """تعدادِ ورزش‌های انجام‌شده از `since` به بعد."""
    total = MissionCompletion.objects.filter(
        user=user, day__gte=since, template__category=MissionTemplate.Category.SPORT).count()
    rows = KidData.objects.filter(user=user, key__startswith=SPORT_DONE_PREFIX).values_list("key", "value")
    for key, raw in rows:
        match = SPORT_DONE_RE.match(key)
        if not match or match.group(1) < since.isoformat():
            continue
        total += len({str(item) for item in _json_list(raw)})
    return total
