"""منطقِ کلاب — مأموریت‌ها، ورزش، استریکِ شنبه‌محور، مدال‌ها و فروشگاه."""
from __future__ import annotations

from datetime import date, timedelta

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from apps.common import cache

from .models import (
    Medal,
    MissionAssignment,
    MissionCompletion,
    MissionTemplate,
    Purchase,
    ShopItem,
)

WEEK_DAY_LABELS = ["ش", "ی", "د", "س", "چ", "پ", "ج"]  # شنبه ... جمعه
MISSION_DEW = 3  # DEW_REWARD.mission


def today() -> date:
    return timezone.localdate()


def week_start(ref: date | None = None) -> date:
    """شنبه‌ی همین هفته (پایه‌ی «این هفته» که هر شنبه ریست می‌شود)."""
    ref = ref or today()
    # weekday(): دوشنبه=۰ ... شنبه=۵
    return ref - timedelta(days=(ref.weekday() - 5) % 7)


# ---------- کلیدِ cacheِ روزانه ----------
def _summary_key(uid: int) -> str:
    return cache.user_key(uid, f"club:summary:{today().isoformat()}")


# ---------- مأموریت‌های امروز ----------
def _todays_templates(user, category: str):
    """قالب‌های ثابتِ روزانه + قالب‌های نسبت‌داده‌شده به این بچه برای امروز."""
    d = today()
    assigned_ids = MissionAssignment.objects.filter(
        child=user, is_active=True, template__category=category, template__is_active=True
    ).filter(Q(date__isnull=True) | Q(date=d)).values_list("template_id", flat=True)

    return MissionTemplate.objects.filter(
        category=category, is_active=True
    ).filter(Q(is_fixed=True) | Q(id__in=list(assigned_ids))).distinct()


def _completed_ids_today(user) -> set[int]:
    return set(
        MissionCompletion.objects.filter(user=user, day=today())
        .values_list("template_id", flat=True)
    )


def _mission_item(t: MissionTemplate, done_ids: set[int]) -> dict:
    return {
        "id": str(t.id),
        "title": t.title,
        "coinReward": t.coin_reward,
        "icon": t.icon,
        "isSuggested": t.is_suggested,
        "done": t.id in done_ids,
    }


def todays_missions(user, category: str) -> list[dict]:
    done_ids = _completed_ids_today(user)
    return [_mission_item(t, done_ids) for t in _todays_templates(user, category)]


# ---------- استریک و هفته ----------
def _completion_days(user) -> set[date]:
    return set(MissionCompletion.objects.filter(user=user).values_list("day", flat=True))


def get_streak(user) -> int:
    days = _completion_days(user)
    if not days:
        return 0
    cursor = today()
    if cursor not in days:
        cursor -= timedelta(days=1)
    streak = 0
    while cursor in days:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


def get_total_tasks(user) -> int:
    return MissionCompletion.objects.filter(user=user).count()


def week_grid(user) -> list[dict]:
    start = week_start()
    done_days = _completion_days(user)
    now = today()
    grid = []
    for i, label in enumerate(WEEK_DAY_LABELS):
        d = start + timedelta(days=i)
        grid.append({
            "label": label,
            "date": d.isoformat(),
            "isDone": d in done_days,
            "isToday": d == now,
            "isFuture": d > now,
        })
    return grid


# ---------- مدال‌ها ----------
def _stats_bundle(user) -> dict:
    from apps.games.services import completed_count
    return {
        "total_tasks": get_total_tasks(user),
        "streak": get_streak(user),
        "purchases": Purchase.objects.filter(user=user).count(),
        "games": completed_count(user),
    }


def _is_medal_unlocked(medal: Medal, s: dict) -> bool:
    c, t = medal.criteria, medal.threshold
    if c == Medal.Criteria.FIRST_TASK:
        return s["total_tasks"] >= 1
    if c == Medal.Criteria.STREAK:
        return s["streak"] >= t
    if c == Medal.Criteria.TOTAL_TASKS:
        return s["total_tasks"] >= t
    if c == Medal.Criteria.PURCHASES:
        return s["purchases"] >= t
    if c == Medal.Criteria.GAMES:
        return s["games"] >= t
    return False


def medals_view(user) -> list[dict]:
    s = _stats_bundle(user)
    return [
        {"id": m.key, "title": m.title, "description": m.description,
         "icon": m.icon, "unlocked": _is_medal_unlocked(m, s)}
        for m in Medal.objects.filter(is_active=True)
    ]


def count_unlocked_medals(user) -> int:
    s = _stats_bundle(user)
    return sum(1 for m in Medal.objects.filter(is_active=True) if _is_medal_unlocked(m, s))


# ---------- فروشگاه ----------
def shop_view(user) -> list[dict]:
    owned = set(Purchase.objects.filter(user=user).values_list("item__item_key", flat=True))
    return [
        {"id": i.item_key, "title": i.title, "description": i.description,
         "icon": i.icon, "cost": i.cost, "owned": i.item_key in owned}
        for i in ShopItem.objects.filter(is_active=True)
    ]


# ---------- خلاصه (cache‌شده) ----------
def build_summary(user) -> dict:
    return {
        "coins": user.profile.coins,
        "streak": get_streak(user),
        "totalTasks": get_total_tasks(user),
        "week": week_grid(user),
        "missions": todays_missions(user, MissionTemplate.Category.MISSION),
        "sports": todays_missions(user, MissionTemplate.Category.SPORT),
        "medals": medals_view(user),
        "shop": shop_view(user),
    }


def get_summary(user) -> dict:
    return cache.get_or_set(_summary_key(user.id), lambda: build_summary(user),
                            cache.TTL_SHORT)


def _invalidate(user):
    cache.invalidate(_summary_key(user.id), cache.profile_key(user.id))


# ---------- اکشن‌ها ----------
class ClubError(Exception):
    """خطای منطقیِ کلاب با پیامِ فارسی."""


@transaction.atomic
def complete_mission(user, template_id: int) -> dict:
    from apps.accounts.models import Profile
    from apps.garden.services import grant_dew

    valid_ids = {t.id for t in _todays_templates(user, MissionTemplate.Category.MISSION)} | {
        t.id for t in _todays_templates(user, MissionTemplate.Category.SPORT)
    }
    if template_id not in valid_ids:
        raise ClubError("این مأموریت امروز برای تو فعال نیست.")

    template = MissionTemplate.objects.get(id=template_id)
    _, created = MissionCompletion.objects.get_or_create(
        user=user, template=template, day=today(),
        defaults={"coins_awarded": template.coin_reward},
    )
    if not created:
        return {"alreadyDone": True, "coins": 0, "dew": 0}

    profile = Profile.objects.select_for_update().get(user=user)
    profile.coins += template.coin_reward
    profile.points += template.coin_reward
    profile.save(update_fields=["coins", "points", "updated_at"])

    grant_dew(user, MISSION_DEW, source="mission")
    _invalidate(user)
    return {"alreadyDone": False, "coins": template.coin_reward, "dew": MISSION_DEW}


@transaction.atomic
def redeem(user, item_key: str) -> dict:
    from apps.accounts.models import Profile

    item = ShopItem.objects.filter(item_key=item_key, is_active=True).first()
    if item is None:
        raise ClubError("این جایزه موجود نیست.")
    if Purchase.objects.filter(user=user, item=item).exists():
        raise ClubError("این جایزه رو قبلاً گرفتی.")
    profile = Profile.objects.select_for_update().get(user=user)
    if profile.coins < item.cost:
        raise ClubError("سکه کافی نداری.")
    profile.coins -= item.cost
    profile.save(update_fields=["coins", "updated_at"])
    Purchase.objects.create(user=user, item=item)
    _invalidate(user)
    return {"owned": True, "coins": profile.coins}


@transaction.atomic
def suggest_mission(created_by, child, *, title: str, coin_reward: int,
                    category: str, bonus: int = 5) -> MissionAssignment:
    """معلم/والد یک مأموریتِ پیشنهادی (امتیاز کمی بیشتر) برای بچه می‌گذارد."""
    template = MissionTemplate.objects.create(
        title=title, coin_reward=coin_reward + bonus, category=category,
        is_suggested=True, is_fixed=False, created_by=created_by,
    )
    assignment = MissionAssignment.objects.create(
        template=template, child=child, date=today(), created_by=created_by,
    )
    cache.invalidate(_summary_key(child.id))
    return assignment
