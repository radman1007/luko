"""سرویس آمار پروفایل — تجمیعِ چند بخش، با cache در Redis و باطل‌سازیِ صریح."""
from __future__ import annotations

from apps.common import cache

from .constants import BUILDER_UNLOCK
from .models import User


def _lukorian_view(user: User) -> dict:
    luk = user.lukorian
    return {
        "unlocked": luk.unlocked,
        "isBuilt": luk.is_built,
        "config": luk.config,
        "ownedItems": luk.owned_items,
        "customStatus": luk.custom_status,
    }


def build_profile_stats(user: User) -> dict:
    """محاسبه‌ی خام آمار پروفایل (بدون cache)."""
    from apps.club.services import get_streak, get_total_tasks, count_unlocked_medals
    from apps.games.services import completed_count

    profile = user.profile
    games_completed = completed_count(user)
    total_tasks = get_total_tasks(user)
    streak = get_streak(user)
    medals = count_unlocked_medals(user)

    unlock_progress = {
        "coins": {"have": profile.coins, "need": BUILDER_UNLOCK["coins"]},
        "totalTasks": {"have": total_tasks, "need": BUILDER_UNLOCK["totalTasks"]},
        "streak": {"have": streak, "need": BUILDER_UNLOCK["streak"]},
        "gamesCompleted": {"have": games_completed, "need": BUILDER_UNLOCK["gamesCompleted"]},
    }
    can_unlock = all(p["have"] >= p["need"] for p in unlock_progress.values())

    return {
        "coins": profile.coins,
        "points": profile.points,
        "treasures": profile.treasures,
        "gamesCompleted": games_completed,
        "medalsUnlocked": medals,
        "totalTasks": total_tasks,
        "streak": streak,
        "lukorian": _lukorian_view(user),
        "builderUnlock": {"thresholds": BUILDER_UNLOCK, "progress": unlock_progress,
                          "canUnlock": can_unlock},
    }


def get_profile_stats(user: User) -> dict:
    """نسخه‌ی cache‌شده — با هر تغییرِ سکه/بازی/مأموریت باطل می‌شود."""
    return cache.get_or_set(
        cache.profile_key(user.id),
        lambda: build_profile_stats(user),
        cache.TTL_MEDIUM,
    )


def invalidate_profile(user_id: int) -> None:
    cache.invalidate(cache.profile_key(user_id))
