"""منطق بازی‌ها — تکمیل و پاداشِ سمت‌سرور (تنها منبعِ حقیقتِ سکه/شبنم/گنج)."""
from __future__ import annotations

from django.db import transaction

from apps.accounts.constants import TREASURE_REWARDS
from apps.accounts.models import Profile
from apps.common import cache

from .models import Game, GameCompletion


class StageLocked(Exception):
    """مرحله‌ی قبلی تمام نشده. arg[0] = عنوانِ مرحله‌ای که باید اول برود."""


def blocking_stage(user, game: Game) -> Game | None:
    """
    اولین مرحله‌ی مسیرِ سیزن که پیش از این بازی است و هنوز تمام نشده.
    None یعنی راه باز است. بازی‌های خارج از مسیر (`season_order == 0`)
    شرطی ندارند.
    """
    if not game.season_order:
        return None
    return (
        Game.objects.filter(
            is_active=True,
            season_order__gt=0,
            season_order__lt=game.season_order,
        )
        .exclude(slug__in=GameCompletion.objects.filter(user=user).values("game_slug"))
        .order_by("season_order")
        .first()
    )


def completed_count(user) -> int:
    return GameCompletion.objects.filter(user=user).count()


def completed_slugs(user) -> list[str]:
    return list(GameCompletion.objects.filter(user=user).values_list("game_slug", flat=True))


def _book_just_completed(user, book_id: str) -> bool:
    """آیا با همین تکمیل، کلِ بازی‌های این کتاب کامل شد؟"""
    if not book_id:
        return False
    total = Game.objects.filter(book_id=book_id, is_active=True).count()
    if total == 0:
        return False
    done = GameCompletion.objects.filter(
        user=user, game_slug__in=Game.objects.filter(book_id=book_id).values("slug")
    ).count()
    return done >= total


@transaction.atomic
def complete_game(user, slug: str) -> dict:
    """
    تکمیلِ idempotent: بار اول پاداش می‌دهد، بارهای بعد فقط وضعیت را برمی‌گرداند.
    سکه/امتیاز روی پروفایل، شبنم/کود روی باغچه، و گنجِ اتمامِ کتاب اعمال می‌شود.
    """
    game = Game.objects.filter(slug=slug).first()

    # مسیرِ سیزن پشتِ‌سرهم است: تا مرحله‌ی قبلی تمام نشود این یکی پاداش
    # نمی‌گیرد. چون سکه اینجا صادر می‌شود، بررسی باید همین‌جا باشد نه فقط
    # در UI — وگرنه با یک درخواستِ مستقیم دور می‌خورد.
    if game is not None and not GameCompletion.objects.filter(user=user, game_slug=slug).exists():
        blocker = blocking_stage(user, game)
        if blocker is not None:
            raise StageLocked(blocker.title)

    coin = game.coin_reward if game else 10
    dew = game.dew_reward if game else 6
    fert = game.fertilizer_reward if game else 1
    book_id = game.book_id if game else ""

    completion, created = GameCompletion.objects.get_or_create(
        user=user, game_slug=slug, defaults={"coins_awarded": coin}
    )
    if not created:
        return {"alreadyDone": True, "coins": 0, "dew": 0, "fertilizer": 0, "treasures": 0}

    profile = Profile.objects.select_for_update().get(user=user)
    profile.coins += coin
    profile.points += coin

    treasures = 0
    if _book_just_completed(user, book_id):
        treasures = TREASURE_REWARDS["bookCompleted"]
        profile.treasures += treasures
    profile.save(update_fields=["coins", "points", "treasures", "updated_at"])

    # پاداشِ باغچه (شبنم + کود) — منبعِ «بازی»
    from apps.garden.services import grant_dew, grant_fertilizer
    grant_dew(user, dew, source="game")
    grant_fertilizer(user, fert)

    # باطل‌سازیِ نماهای متأثر — گزارشِ پنل والدین هم همین‌جا تازه می‌شود
    cache.invalidate(
        cache.profile_key(user.id),
        cache.club_summary_key(user.id),
        cache.garden_key(user.id),
        cache.parent_report_key(user.id),
    )

    return {"alreadyDone": False, "coins": coin, "dew": dew,
            "fertilizer": fert, "treasures": treasures}
