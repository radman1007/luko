"""
پیشنهادِ «بازی روز» برای هر بچه.

منطق ساده و قابلِ توضیح است تا والد بداند چرا این بازی پیشنهاد شده:
۱) بازی‌هایی که مبحثِ ضعیفِ بچه را تمرین می‌دهند، اول می‌آیند.
۲) بعد بازی‌هایی که هنوز شروع نشده‌اند (چیزِ تازه).
۳) بعد بازی‌هایی با کمترین دقت (جای پیشرفت).
هر پیشنهاد یک `why` دارد که همان جمله‌ای است که در پنل نشان داده می‌شود.
"""
from __future__ import annotations

from collections import defaultdict

from django.core.cache import cache
from django.utils import timezone

from apps.common import cache as cache_keys
from apps.common import cache as cache_utils
from apps.common.fa import fa_digits
from apps.games.models import Book, Game, GameCompletion, GameEvent

from .services import TOPIC_LABELS

SUGGESTION_COUNT = 4
DEFAULT_MINUTES = 7
TOPIC_SAMPLE = 4000      # چند رویدادِ آخر برای کشفِ مبحث‌های هر بازی کافی است


def topics_by_game() -> dict[str, set[str]]:
    """
    نقشه‌ی «هر بازی چه مبحث‌هایی را تمرین می‌دهد».

    این یک ویژگیِ کم‌تغییرِ محتواست، نه دادهٔ کاربر؛ پس روی نمونه‌ی محدودی از
    تازه‌ترین رویدادها ساخته و در cache نگه داشته می‌شود. (قبلاً کلِ جدولِ
    رویدادها اسکن می‌شد و با بزرگ‌شدنِ داده، این اندپوینت کند می‌شد.)
    """
    cached = cache.get(cache_keys.game_topics_key())
    if cached is not None:
        return {slug: set(topics) for slug, topics in cached.items()}

    mapping: dict[str, set[str]] = defaultdict(set)
    rows = (
        GameEvent.objects.filter(event_type="answer")
        .order_by("-id")
        .values_list("game_slug", "payload")[:TOPIC_SAMPLE]
    )
    for slug, payload in rows:
        topic = (payload or {}).get("topic") if isinstance(payload, dict) else None
        if topic:
            mapping[slug].add(topic)

    cache.set(
        cache_keys.game_topics_key(),
        {slug: sorted(topics) for slug, topics in mapping.items()},
        cache_keys.TTL_LONG,
    )
    return mapping


def _payload(event: GameEvent) -> dict:
    return event.payload if isinstance(event.payload, dict) else {}


def _weakest_topic(child) -> tuple[str, int] | None:
    """مبحثی که کمترین دقت را دارد (دستِ‌کم ۱۰ پاسخ تا نویز نباشد)."""
    buckets: dict[str, dict[str, int]] = defaultdict(lambda: {"asked": 0, "correct": 0})
    answers = GameEvent.objects.filter(user=child, event_type="answer")
    for event in answers:
        payload = _payload(event)
        topic = payload.get("topic")
        if not topic:
            continue
        buckets[topic]["asked"] += 1
        if payload.get("correct"):
            buckets[topic]["correct"] += 1

    ranked = [
        (topic, round(data["correct"] / data["asked"] * 100))
        for topic, data in buckets.items()
        if data["asked"] >= 10
    ]
    if not ranked:
        return None
    ranked.sort(key=lambda row: row[1])
    return ranked[0]


def _accuracy_by_game(child) -> dict[str, int]:
    buckets: dict[str, dict[str, int]] = defaultdict(lambda: {"asked": 0, "correct": 0})
    for event in GameEvent.objects.filter(user=child, event_type="answer"):
        buckets[event.game_slug]["asked"] += 1
        if _payload(event).get("correct"):
            buckets[event.game_slug]["correct"] += 1
    return {
        slug: round(data["correct"] / data["asked"] * 100)
        for slug, data in buckets.items()
        if data["asked"]
    }


def _minutes(game: Game) -> int:
    """زمانِ تقریبیِ بازی — از روی جایزه‌ی سکه‌اش تخمین می‌خورد."""
    return max(5, min(12, round(game.coin_reward / 2))) if game.coin_reward else DEFAULT_MINUTES


def suggest_games(child, limit: int = SUGGESTION_COUNT) -> list[dict]:
    games = list(Game.objects.all().order_by("order", "id"))
    if not games:
        return []

    books = {b.book_id: b for b in Book.objects.all()}
    done = {c.game_slug for c in GameCompletion.objects.filter(user=child)}
    accuracy = _accuracy_by_game(child)
    weakest = _weakest_topic(child)
    weak_topic = weakest[0] if weakest else None
    weak_label = TOPIC_LABELS.get(weak_topic, weak_topic) if weak_topic else None

    topics_of_game = topics_by_game()

    scored = []
    for game in games:
        book = books.get(game.book_id)
        covers_weak = bool(weak_topic and weak_topic in topics_of_game.get(game.slug, set()))
        game_accuracy = accuracy.get(game.slug)

        # رتبه‌بندی با «پوششِ مبحثِ ضعیف» است، ولی جمله‌ی توضیح از واقعیتِ همان بازی
        # می‌آید تا چهار پیشنهاد چهار جمله‌ی متفاوت داشته باشند، نه یک جمله‌ی تکراری.
        if game.slug not in done:
            why = "هنوز این بازی را انجام نداده است"
        elif game_accuracy is not None and game_accuracy < 70:
            why = f"دقتش در این بازی {fa_digits(game_accuracy)}٪ بوده؛ جای پیشرفت دارد"
        elif game_accuracy is not None:
            why = f"دقتش در این بازی {fa_digits(game_accuracy)}٪ است؛ مرورِ خوبی می‌شود"
        else:
            why = "مرورِ چیزی که قبلاً کار کرده است"

        if covers_weak:
            score = 0
            topic_label = weak_label
            why = f"{why} — و مبحثِ «{weak_label}» را تمرین می‌دهد"
        elif game.slug not in done:
            score = 1
            topic_label = book.subject if book else "تازه"
        elif game_accuracy is not None and game_accuracy < 70:
            score = 2
            topic_label = book.subject if book else ""
        else:
            score = 3
            topic_label = book.subject if book else ""

        scored.append({
            "slug": game.slug,
            "title": game.title,
            "bookTitle": book.title if book else "",
            "subject": book.subject if book else "",
            "topic": topic_label,
            "minutes": _minutes(game),
            "coinReward": game.coin_reward,
            "why": why,
            "recommended": False,
            "played": game.slug in done,
            "_score": score,
            "_accuracy": game_accuracy if game_accuracy is not None else 100,
        })

    scored.sort(key=lambda row: (row["_score"], row["_accuracy"]))
    top = scored[:limit]
    for row in top:
        row.pop("_score", None)
        row.pop("_accuracy", None)
    if top:
        top[0]["recommended"] = True
    return top


def suggestion_payload(child) -> dict:
    from .models import DailyAssignment

    today = timezone.localdate()
    # «بازی روز» را والد همین حالا ممکن است عوض کند، پس تازه خوانده می‌شود
    # (یک کوئریِ ایندکس‌دار). چیزی که گران است تجمیعِ رویدادهاست و همان کش می‌شود.
    current = DailyAssignment.objects.filter(child=child, date=today).first()
    suggestions = cache_utils.get_or_set(
        cache_keys.parent_suggestions_key(child.id),
        lambda: suggest_games(child),
        cache_utils.TTL_MEDIUM,
    )
    return {
        "date": today.isoformat(),
        "currentSlug": current.game_slug if current else None,
        "suggestions": suggestions,
    }
