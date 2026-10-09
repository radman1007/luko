"""ثبتِ ضربانِ حضور و آمارهای داشبورد."""
from __future__ import annotations

import re
from datetime import datetime, timedelta

from django.db import IntegrityError, transaction
from django.db.models import Count, F, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone

from apps.accounts.models import User

from .models import ActivitySlot

#: دو ضربان از یک صفحه که کمتر از این فاصله دارند (مثلاً دو تبِ باز) یک دقیقه‌اند
BEAT_GAP = timedelta(seconds=50)
#: «الان آنلاین»: ضربانی در این بازه
ONLINE_WINDOW = timedelta(seconds=150)
#: آخرین بازدیدِ کاربر هر بار نوشته نمی‌شود
LAST_SEEN_EVERY = timedelta(seconds=60)
#: نگه‌داریِ ردیف‌ها
KEEP_DAYS = 400

DEVICE_RE = re.compile(r"^[A-Za-z0-9-]{8,40}$")


def audience_of(user: User | None) -> str:
    if user is None:
        return ActivitySlot.Audience.GUEST
    if user.is_staff or user.role in (User.Role.TEAM_ADMIN, User.Role.SCHOOL_ADMIN, User.Role.TEACHER):
        return ActivitySlot.Audience.STAFF
    if user.role == User.Role.PARENT:
        return ActivitySlot.Audience.PARENT
    return ActivitySlot.Audience.STUDENT


def hour_start(moment: datetime) -> datetime:
    """آغازِ ساعتِ تهرانیِ این لحظه (aware)."""
    return timezone.localtime(moment).replace(minute=0, second=0, microsecond=0)


def record_beat(*, user: User | None, device: str, platform: str, now: datetime | None = None) -> bool:
    """یک ضربان. False یعنی ورودیِ نامعتبر (مهمانِ بی‌شناسه یا سکوی ناشناخته)."""
    if platform not in ActivitySlot.Platform.values:
        return False
    if user is None and not DEVICE_RE.match(device or ""):
        return False
    now = now or timezone.now()
    visitor = f"u:{user.pk}" if user else f"g:{device}"
    hour = hour_start(now)
    try:
        with transaction.atomic():
            slot, created = ActivitySlot.objects.get_or_create(
                visitor=visitor, platform=platform, hour=hour,
                defaults={"user": user, "audience": audience_of(user), "minutes": 1, "last_beat": now},
            )
    except IntegrityError:      # دو ضربانِ هم‌زمان؛ دیگری ساخت
        created = False
        slot = ActivitySlot.objects.get(visitor=visitor, platform=platform, hour=hour)
    if not created:
        ActivitySlot.objects.filter(pk=slot.pk, last_beat__lte=now - BEAT_GAP).update(
            minutes=F("minutes") + 1, last_beat=now)
    if user is not None and (user.last_seen_at is None or now - user.last_seen_at >= LAST_SEEN_EVERY
                             or user.last_seen_platform != platform):
        User.objects.filter(pk=user.pk).update(last_seen_at=now, last_seen_platform=platform)
    return True


def _scope(qs, platform: str | None = None, audience: str | None = None):
    if platform in ActivitySlot.Platform.values:
        qs = qs.filter(platform=platform)
    if audience in ActivitySlot.Audience.values:
        qs = qs.filter(audience=audience)
    return qs


def online_now(now: datetime | None = None) -> dict:
    """{web, android, total, users, guests} — بازدیدکننده‌ی یکتا در ۱۵۰ ثانیه‌ی اخیر."""
    now = now or timezone.now()
    recent = ActivitySlot.objects.filter(last_beat__gte=now - ONLINE_WINDOW)
    by_platform = dict(recent.values("platform").annotate(n=Count("visitor", distinct=True))
                       .values_list("platform", "n"))
    return {
        "web": by_platform.get("web", 0),
        "android": by_platform.get("android", 0),
        "total": recent.values("visitor").distinct().count(),
        "users": recent.exclude(audience=ActivitySlot.Audience.GUEST).values("visitor").distinct().count(),
        "guests": recent.filter(audience=ActivitySlot.Audience.GUEST).values("visitor").distinct().count(),
    }


def hourly(hours: int = 24, *, platform=None, audience=None, now=None) -> list[dict]:
    """فعال‌ها در هر ساعتِ اخیر (به وقتِ تهران)، با ساعت‌های خالی."""
    now = now or timezone.now()
    end = hour_start(now)
    start = end - timedelta(hours=hours - 1)
    rows = (_scope(ActivitySlot.objects.filter(hour__gte=start), platform, audience)
            .values("hour").annotate(visitors=Count("visitor", distinct=True), minutes=Sum("minutes")))
    found = {timezone.localtime(r["hour"]): r for r in rows}
    out = []
    for i in range(hours):
        at = start + timedelta(hours=i)
        row = found.get(at, {})
        out.append({"at": at, "visitors": row.get("visitors", 0), "minutes": row.get("minutes") or 0})
    return out


def daily(days: int = 30, *, platform=None, audience=None, now=None) -> list[dict]:
    """فعال‌های یکتای هر روز، مجموعِ دقیقه و میانگینِ دقیقه برای هر فعال."""
    now = now or timezone.now()
    today = timezone.localdate(now)
    first = today - timedelta(days=days - 1)
    start = timezone.make_aware(datetime.combine(first, datetime.min.time()))
    rows = (_scope(ActivitySlot.objects.filter(hour__gte=start), platform, audience)
            .annotate(day=TruncDate("hour", tzinfo=timezone.get_current_timezone()))
            .values("day").annotate(visitors=Count("visitor", distinct=True), minutes=Sum("minutes")))
    found = {r["day"]: r for r in rows}
    out = []
    for i in range(days):
        day = first + timedelta(days=i)
        row = found.get(day, {})
        visitors, minutes = row.get("visitors", 0), row.get("minutes") or 0
        out.append({"day": day, "visitors": visitors, "minutes": minutes,
                    "avg_minutes": round(minutes / visitors, 1) if visitors else 0})
    return out


def totals(since: datetime, *, platform=None, audience=None) -> dict:
    """فعال‌های یکتا و میانگینِ دقیقه در کلِ بازه (میانگینِ روزانه‌ی هر فعال)."""
    qs = _scope(ActivitySlot.objects.filter(hour__gte=since), platform, audience)
    visitors = qs.values("visitor").distinct().count()
    minutes = qs.aggregate(m=Sum("minutes"))["m"] or 0
    per_day = (qs.annotate(day=TruncDate("hour", tzinfo=timezone.get_current_timezone()))
               .values("day", "visitor").distinct().count())
    return {
        "visitors": visitors,
        "minutes": minutes,
        # میانگینِ دقیقه در هر «روزِ حضورِ» یک بازدیدکننده
        "avg_minutes": round(minutes / per_day, 1) if per_day else 0,
    }


def user_activity(user: User, days: int = 30, now=None) -> dict:
    """خلاصه‌ی حضورِ یک کاربر برای صفحه‌ی جزئیات."""
    now = now or timezone.now()
    since = now - timedelta(days=days)
    qs = ActivitySlot.objects.filter(user=user, hour__gte=since)
    per_platform = dict(qs.values("platform").annotate(m=Sum("minutes")).values_list("platform", "m"))
    by_day = dict(qs.annotate(day=TruncDate("hour", tzinfo=timezone.get_current_timezone()))
                  .values("day").annotate(m=Sum("minutes")).values_list("day", "m"))
    today = timezone.localdate(now)
    return {
        "minutes": sum(per_platform.values()),
        "web_minutes": per_platform.get("web", 0),
        "android_minutes": per_platform.get("android", 0),
        "active_days": len(by_day),
        "series": [{"day": today - timedelta(days=days - 1 - i),
                    "minutes": by_day.get(today - timedelta(days=days - 1 - i), 0)} for i in range(days)],
    }


def prune(now=None) -> int:
    now = now or timezone.now()
    deleted, _ = ActivitySlot.objects.filter(hour__lt=now - timedelta(days=KEEP_DAYS)).delete()
    return deleted
