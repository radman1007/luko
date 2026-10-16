"""کارهای صفِ «ai» (کارگرِ جدا تا کارهای پرداخت پشتِ درخواست‌های چندثانیه‌ای نمانند)."""
from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.utils import timezone

from . import client


@shared_task(ignore_result=True)
def generate_insight(child_id: int, premium: bool, fp_hint: str = "") -> bool:
    from apps.accounts.models import User

    from .insights import generate

    child = User.objects.filter(pk=child_id).first()
    return bool(child and generate(child, premium, fp_hint))


@shared_task(ignore_result=True)
def answer_question(reply_id: int) -> bool:
    from .assistant import answer

    return answer(reply_id) is not None


@shared_task(ignore_result=True)
def analyze_painting(analysis_id: int) -> bool:
    from .paintings import analyze

    return analyze(analysis_id) is not None


@shared_task(ignore_result=True)
def refresh_recent() -> int:
    """
    هر سحر: تحلیلِ بچه‌هایی که دیروز بازی کرده‌اند و والدشان در دو هفته‌ی اخیر سر زده، تا صبح که والد
    پنل را باز می‌کند تحلیلِ تازه آماده باشد (نه «در حالِ تحلیل»).
    """
    if not client.enabled():
        return 0
    from apps.billing.services import subscription
    from apps.games.models import GameEvent
    from apps.parent.models import ParentChild

    from .insights import generate

    since = timezone.now() - timedelta(days=2)
    active = set(GameEvent.objects.filter(occurred_at__gte=since).values_list("user_id", flat=True).distinct())
    links = (ParentChild.objects.filter(child_id__in=active, is_active=True,
                                        parent__last_seen_at__gte=timezone.now() - timedelta(days=14))
             .select_related("child").order_by("child_id"))
    done, seen = 0, set()
    for link in links:
        if link.child_id in seen or done >= settings.AI_NIGHTLY_LIMIT:
            continue
        seen.add(link.child_id)
        if generate(link.child, subscription(link.child).active):
            done += 1
    return done
