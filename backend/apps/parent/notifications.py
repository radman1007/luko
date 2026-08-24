"""
ساختِ اعلان‌های والد از رویِ داده‌ی واقعی.

هیچ اعلانی دستی ساخته نمی‌شود: هر بار که والد فهرست را می‌گیرد، از فعالیتِ
واقعیِ بچه‌ها اعلان‌های تازه ساخته می‌شود و `dedup_key` جلوی تکرار را می‌گیرد.
اینکه اعلان خوانده شده یا نه، در همان ردیف می‌ماند.
"""
from __future__ import annotations

from datetime import timedelta

from django.core.cache import cache
from django.utils import timezone

from apps.common.fa import fa_digits
from apps.games.models import Game, GameCompletion, GameEvent
from apps.health.models import MoodCheckin

from .models import DailyAssignment, Notification, ParentChild, ParentPreference

MOOD_LABELS = {
    "happy": "خوشحال", "calm": "آرام", "tired": "خسته",
    "sad": "ناراحت", "angry": "عصبانی",
}

IDLE_DAYS = 3
SYNC_THROTTLE = 60       # فاصله‌ی حداقلِ دو همگام‌سازی (ثانیه)
RECENT_DAYS = 2          # بازی‌های چند روزِ اخیر اعلان می‌گیرند
RECENT_GAMES = 5         # سقفِ اعلانِ بازی برای هر فرزند در هر بار همگام‌سازی


def reset_sync_throttle(parent) -> None:
    """گاردِ همگام‌سازی را برمی‌دارد تا درخواستِ بعدی دوباره اعلان بسازد."""
    cache.delete(f"notif-sync:{parent.id}")


def preferences(parent) -> ParentPreference:
    pref, _ = ParentPreference.objects.get_or_create(parent=parent)
    return pref


def _child_name(link: ParentChild) -> str:
    child = link.child
    return (child.first_name or child.phone).strip()


def _week_key(day) -> str:
    """کلیدِ هفته‌ی ایرانی (شنبه‌محور) برای جلوگیری از اعلانِ تکراری."""
    saturday = day - timedelta(days=(day.weekday() + 2) % 7)
    return saturday.isoformat()


def _add(rows: list, *, user, child, kind, title, body, key):
    rows.append(
        Notification(user=user, child=child, kind=kind, title=title, body=body, dedup_key=key)
    )


def sync_notifications(parent, force: bool = False) -> None:
    """
    اعلان‌های تازه را می‌سازد. چندبار صدا زدنش بی‌خطر است.

    پنل هر بار که باز/رفرش شود این را صدا می‌زند، ولی ساختِ اعلان به چند کوئری
    به‌ازای هر فرزند نیاز دارد. پس نتیجه‌ی همگام‌سازی برای یک دقیقه علامت‌گذاری
    می‌شود و درخواست‌های پشتِ‌سرِ هم فقط فهرست را می‌خوانند.
    """
    guard = f"notif-sync:{parent.id}"
    if not force and cache.get(guard):
        return
    cache.set(guard, 1, SYNC_THROTTLE)

    pref = preferences(parent)
    today = timezone.localdate()
    week_key = _week_key(today)
    week_start = today - timedelta(days=(today.weekday() + 2) % 7)

    links = ParentChild.objects.filter(parent=parent, is_active=True).select_related("child")
    games = dict(Game.objects.values_list("slug", "title"))
    fresh: list[Notification] = []

    for link in links:
        child = link.child
        name = _child_name(link)

        # ۱) گزارشِ هفتگی — فقط اگر بچه در این هفته فعالیتی داشته
        week_events = GameEvent.objects.filter(user=child, created_at__date__gte=week_start)
        if pref.weekly_report and week_events.exists():
            _add(
                fresh, user=parent, child=child, kind=Notification.Kind.WEEKLY,
                title=f"گزارش هفتگی {name} آماده شد",
                body="خلاصه‌ی این هفته را در داشبورد ببینید.",
                key=f"weekly:{child.id}:{week_key}",
            )

        # ۲) بازی‌های کامل‌شده — هر بازی یک اعلان، با کلیدِ خودِ همان تکمیل.
        #    (قبلاً شمارشِ هفته در کلید بود و هر بازیِ تازه یک اعلانِ تکراریِ دیگر می‌ساخت)
        if pref.activity_alerts:
            recent = GameCompletion.objects.filter(
                user=child, created_at__date__gte=today - timedelta(days=RECENT_DAYS)
            ).order_by("-created_at")[:RECENT_GAMES]
            for completion in recent:
                title = games.get(completion.game_slug)
                _add(
                    fresh, user=parent, child=child, kind=Notification.Kind.GAMES,
                    title=f"{name} «{title or completion.game_slug}» را کامل کرد",
                    body="جزئیاتِ دقت و زمانش در تبِ گزارش‌ها هست.",
                    key=f"game-done:{completion.id}",
                )

        # ۳) آخرین ثبتِ حال
        mood = MoodCheckin.objects.filter(user=child).order_by("-created_at").first()
        if pref.activity_alerts and mood:
            mood_day = timezone.localtime(mood.created_at).date()
            if (today - mood_day).days <= 1:
                _add(
                    fresh, user=parent, child=child, kind=Notification.Kind.MOOD,
                    title=f"ثبت حال {name}: {MOOD_LABELS.get(mood.mood, mood.mood)}",
                    body="روند حال و روحیه را در تبِ سلامت ببینید.",
                    key=f"mood:{child.id}:{mood_day.isoformat()}",
                )

        # ۴) بی‌فعالیتی
        last_event = GameEvent.objects.filter(user=child).order_by("-created_at").first()
        if pref.activity_alerts and last_event:
            idle_days = (today - timezone.localtime(last_event.created_at).date()).days
            if idle_days >= IDLE_DAYS:
                _add(
                    fresh, user=parent, child=child, kind=Notification.Kind.IDLE,
                    title=f"{name} {fa_digits(idle_days)} روز است بازی نکرده",
                    body="یک «بازی روز» بگذارید تا دوباره شروع کند.",
                    key=f"idle:{child.id}:{today.isoformat()}",
                )

        # ۵) بازی روزی که والد گذاشته و بچه انجامش داده
        assignment = DailyAssignment.objects.filter(child=child, date=today).first()
        if assignment and GameCompletion.objects.filter(
            user=child, game_slug=assignment.game_slug, created_at__date=today
        ).exists():
            _add(
                fresh, user=parent, child=child, kind=Notification.Kind.ASSIGNMENT,
                title=f"{name} بازی روز را انجام داد",
                body="بازی‌ای که برایش گذاشته بودید کامل شد.",
                key=f"assignment:{child.id}:{today.isoformat()}",
            )

    if fresh:
        Notification.objects.bulk_create(fresh, ignore_conflicts=True)
