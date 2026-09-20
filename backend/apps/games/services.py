"""منطق بازی‌ها — تکمیل و پاداشِ سمت‌سرور (تنها منبعِ حقیقتِ سکه/شبنم/گنج)."""
from __future__ import annotations

from django.db import transaction

from apps.accounts.constants import TREASURE_REWARDS
from apps.accounts.models import Profile
from apps.common import cache

from .models import Game, GameCompletion


class StageLocked(Exception):
    """مرحله‌ی قبلی تمام نشده. arg[0] = عنوانِ مرحله‌ای که باید اول برود."""


class GameUnavailable(Exception):
    """این بازی روی مسیر نیست (وجود ندارد، نامِ فایلش نامعتبر است، یا غیرفعال است)."""


def blocking_stage(user, game: Game) -> Game | None:
    """
    اولین مرحله‌ی مسیرِ **همان کلاس** که پیش از این بازی است و هنوز تمام
    نشده. None یعنی راه باز است. هر کلاس مسیرِ خودش را دارد؛ مرحله‌ی ۵ِ
    کلاسِ اول نباید پشتِ مرحله‌های کلاسِ دوم بماند.
    """
    if not game.season_order:
        return None
    return (
        Game.objects.playable()
        .filter(grade=game.grade, season_order__gt=0, season_order__lt=game.season_order)
        .exclude(slug__in=GameCompletion.objects.filter(user=user).values("game_slug"))
        .order_by("season_order")
        .first()
    )


def is_first_stage(game: Game) -> bool:
    """اولین مرحله‌ی قابلِ بازیِ مسیرِ کلاسش — تنها مرحله‌ای که مهمان هم دارد."""
    first = (Game.objects.playable().filter(grade=game.grade, season_order__gt=0)
             .order_by("season_order").values_list("pk", flat=True).first())
    return first == game.pk


def grades_with_games() -> list[int]:
    """کلاس‌هایی که همین حالا بازی دارند — فرمِ ثبت‌نام از همین می‌خواند."""
    # `order_by()` لازم است: ترتیبِ پیش‌فرضِ مدل ستون‌هایش را به SELECT اضافه
    # می‌کند و آن‌وقت distinct هر ردیف را جدا می‌شمارد (کلاس‌ها تکراری می‌شدند).
    return sorted(Game.objects.playable().filter(season_order__gt=0)
                  .order_by().values_list("grade", flat=True).distinct())


def game_path(grade: int) -> list[dict]:
    """
    مسیرِ یک کلاس برای صفحه‌ی بچه — فقط آنچه برای نمایش لازم است.

    عمداً هیچ نشانی از کتاب، درس یا کدِ فایل ندارد (UX بازی‌محور است، نه
    درس‌محور). هفته شماره‌ی پشتِ‌سرهمِ هر (فصل، سیزن) است؛ پس فصلِ خالی
    هفته‌ی خالی نمی‌سازد.
    """
    games = (Game.objects.playable().filter(grade=grade, season_order__gt=0)
             .order_by("season_order", "chapter", "week", "number"))
    stages = []
    week = 0
    last = None
    for order, game in enumerate(games, start=1):
        if (game.chapter, game.week) != last:
            last = (game.chapter, game.week)
            week += 1
        stages.append({
            "id": game.slug,
            "title": game.title,
            "order": order,
            "week": week,
            "coinReward": game.coin_reward,
            "maxStars": game.max_stars,
        })
    return stages


def completed_count(user) -> int:
    return GameCompletion.objects.filter(user=user).count()


def completed_slugs(user) -> list[str]:
    return list(GameCompletion.objects.filter(user=user).values_list("game_slug", flat=True))


def _book_just_completed(user, book_id: str) -> bool:
    """آیا با همین تکمیل، کلِ بازی‌های این کتاب کامل شد؟"""
    if not book_id:
        return False
    total = Game.objects.playable().filter(book_id=book_id).count()
    if total == 0:
        return False
    done = GameCompletion.objects.filter(
        user=user, game_slug__in=Game.objects.filter(book_id=book_id).values("slug")
    ).count()
    return done >= total


def star_map(user) -> dict[str, int]:
    """بهترین ستاره‌ی هر بازی. نقشه‌ی سیزن پیشرفتِ ستاره‌ای را از این می‌سازد."""
    return dict(
        GameCompletion.objects.filter(user=user).values_list("game_slug", "stars")
    )


@transaction.atomic
def complete_game(user, slug: str, stars: int | None = None) -> dict:
    """
    تکمیلِ idempotent: بار اول پاداش می‌دهد، بارهای بعد فقط وضعیت را برمی‌گرداند.
    سکه/امتیاز روی پروفایل، شبنم/کود روی باغچه، و گنجِ اتمامِ کتاب اعمال می‌شود.

    `stars` اختیاری است و **بهترین** مقدار نگه داشته می‌شود، نه آخرین: بچه
    برای سه‌ستاره‌کردن دوباره بازی می‌کند و یک اجرای بد نباید دستاوردش را
    پس بگیرد. منطقِ اینکه چه چیزی چند ستاره می‌دهد در خودِ بازی است، نه اینجا.
    """
    # فقط بازیِ روی مسیر پاداش می‌گیرد. قبلاً هر slugِ ساختگی ۱۰ سکه می‌داد،
    # یعنی با چند درخواستِ مستقیم می‌شد سکه‌ی بی‌نهایت ساخت.
    game = Game.objects.playable().filter(slug=slug).first()
    if game is None:
        raise GameUnavailable(slug)

    # مسیرِ سیزن پشتِ‌سرهم است: تا مرحله‌ی قبلی تمام نشود این یکی پاداش
    # نمی‌گیرد. چون سکه اینجا صادر می‌شود، بررسی باید همین‌جا باشد نه فقط
    # در UI — وگرنه با یک درخواستِ مستقیم دور می‌خورد.
    if not GameCompletion.objects.filter(user=user, game_slug=slug).exists():
        blocker = blocking_stage(user, game)
        if blocker is not None:
            raise StageLocked(blocker.title)

    coin = game.coin_reward
    dew = game.dew_reward
    fert = game.fertilizer_reward
    book_id = game.book_id

    cap = game.max_stars
    earned = max(0, min(int(stars), cap)) if stars is not None else 0

    completion, created = GameCompletion.objects.get_or_create(
        user=user, game_slug=slug, defaults={"coins_awarded": coin, "stars": earned}
    )
    if not created:
        improved = earned > completion.stars
        if improved:
            completion.stars = earned
            completion.save(update_fields=["stars", "updated_at"])
            cache.invalidate(cache.parent_report_key(user.id))
        return {"alreadyDone": True, "coins": 0, "dew": 0, "fertilizer": 0,
                "treasures": 0, "stars": completion.stars, "starsImproved": improved}

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
            "fertilizer": fert, "treasures": treasures,
            "stars": completion.stars, "starsImproved": completion.stars > 0}
