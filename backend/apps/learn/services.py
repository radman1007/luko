"""
شکلِ داده‌ی صفحه‌ی «آموزش» و قاعده‌هایش:

- محتوای «ویژه» برای والدی که هیچ فرزندِ مشترکی ندارد قفل است: کارت کامل دیده می‌شود، ولی متن فقط تا چند
  بندِ اول و پخش‌کننده اصلاً نمی‌آید (از سرور بیرون نمی‌رود).
- «پیشنهاد برای فرزندتان» از گزارشِ همان بچه ساخته می‌شود (همان برگه‌ی داده‌ی تحلیلِ هوشمند، apps/ai/facts):
  بازیِ آخرِ شب → خواب و صفحه‌نمایش، مفهومِ پرخطا → یادگیری، روزهای کم → عادت، حالِ خسته یا ناراحت → احساسات.
"""
from __future__ import annotations

import math
import re
from datetime import timedelta

from django.utils import timezone

from apps.blog.markdown import plain_text, render
from apps.common.fa import fa_date, fa_digits

from .models import LearnItem, LearnProgress, Topic

NEW_DAYS = 14
#: «تازه» فقط برای چند تای آخر؛ وقتی همه تازه‌اند (روزِ راه‌اندازی) نشان بی‌معنا می‌شود
NEW_LIMIT = 3
PREVIEW_BLOCKS = 2
_APARAT = re.compile(r"aparat\.com/(?:v/|video/video/embed/videohash/)([A-Za-z0-9]+)")


def live_items():
    return LearnItem.objects.filter(status=LearnItem.Status.PUBLISHED, published_at__lte=timezone.now())


def parent_premium(parent) -> bool:
    """دست‌کم یک فرزندِ وصل با اشتراکِ فعال"""
    from apps.billing.services import subscription
    from apps.parent.models import ParentChild

    links = ParentChild.objects.filter(parent=parent, is_active=True).select_related("child")
    return any(subscription(link.child).active for link in links)


def minutes(item: LearnItem) -> int:
    if item.duration_minutes:
        return item.duration_minutes
    if item.kind == LearnItem.Kind.ARTICLE:
        return max(1, math.ceil(len(plain_text(item.body).split()) / 200))
    return 0


def media(item: LearnItem) -> dict | None:
    """منبعِ پخش: فایلِ همین سرور، آپاراتِ جاسازی‌شده، یا فایلِ مستقیمِ بیرونی"""
    if item.kind == LearnItem.Kind.ARTICLE:
        return None
    if item.media_file:
        return {"type": "video" if item.kind == LearnItem.Kind.VIDEO else "audio", "src": item.media_file.url}
    url = item.media_url or ""
    found = _APARAT.search(url)
    if item.kind == LearnItem.Kind.VIDEO and found:
        return {"type": "embed", "src": f"https://www.aparat.com/video/video/embed/videohash/{found.group(1)}/vt/frame"}
    if url:
        return {"type": "video" if item.kind == LearnItem.Kind.VIDEO else "audio", "src": url}
    return None


def newest_ids(items) -> set[int]:
    cutoff = timezone.now() - timedelta(days=NEW_DAYS)
    recent = sorted((i for i in items if i.published_at and i.published_at >= cutoff),
                    key=lambda i: (i.published_at, i.id), reverse=True)
    return {i.id for i in recent[:NEW_LIMIT]}


def summary(item: LearnItem, *, premium: bool, progress: LearnProgress | None = None,
            new_ids: set[int] | None = None) -> dict:
    published = timezone.localtime(item.published_at) if item.published_at else None
    return {
        "id": item.id,
        "kind": item.kind,
        "kind_label": item.get_kind_display(),
        "title": item.title,
        "summary": item.summary,
        "topic": item.topic,
        "topic_label": item.get_topic_display(),
        "cover": item.cover.url if item.cover else "",
        "minutes": minutes(item),
        "author": item.author,
        "premium": item.premium,
        "locked": item.premium and not premium,
        "featured": item.featured,
        "is_new": item.id in (new_ids or set()),
        "published_fa": fa_date(published.date(), with_year=True) if published else "",
        "saved": bool(progress and progress.saved),
        "done": bool(progress and progress.done),
    }


def _preview(body: str) -> str:
    """چند بندِ اولِ متن برای محتوای قفل (بقیه از سرور بیرون نمی‌رود)"""
    blocks = [b for b in re.split(r"\n\s*\n", (body or "").strip()) if b.strip()]
    return render("\n\n".join(blocks[:PREVIEW_BLOCKS]))


def detail(item: LearnItem, *, premium: bool, progress: LearnProgress | None, related: list[dict],
           new_ids: set[int] | None = None) -> dict:
    out = summary(item, premium=premium, progress=progress, new_ids=new_ids)
    locked = out["locked"]
    out.update({
        "body_html": _preview(item.body) if locked else render(item.body),
        "media": None if locked else media(item),
        "seconds": progress.seconds if progress and not locked else 0,
        "related": related,
    })
    return out


# ---------------------------------------------------------------- پیشنهاد برای فرزند
def reasons_for(child) -> list[tuple[str, str]]:
    """[(موضوع، چرا)] از گزارشِ همین بچه، مهم‌ترین اول"""
    from apps.ai.facts import build_facts
    from apps.billing.services import subscription
    from apps.parent.gating import gate_report
    from apps.parent.services import build_child_report

    name = (child.first_name or "").strip() or "فرزندتان"
    premium = subscription(child).active
    facts = build_facts(gate_report(build_child_report(child), premium), premium=premium, grade=child.grade)
    if facts is None:
        return [(Topic.HABITS, f"{name} این هفته هنوز بازی نکرده؛ ساختنِ یک عادتِ کوچکِ روزانه کمک می‌کند")]
    week = facts.get("week") or {}
    out: list[tuple[str, str]] = []
    late = week.get("late_night_activity_percent", 0)
    if late >= 30:
        out.append((Topic.HEALTH, f"{fa_digits(late)}٪ از بازی‌های {name} آخرِ شب بوده"))
    weak = [c for c in facts.get("concepts_last_8_weeks") or [] if c["answers"] >= 5 and c["accuracy_percent"] < 70]
    if weak:
        out.append((Topic.LEARNING, f"{name} در «{weak[0]['name']}» تمرینِ بیشتری لازم دارد"))
    mood = (facts.get("mood_this_week") or {}).get("most_common_mood")
    if mood in {"خسته", "ناراحت", "عصبانی"}:
        out.append((Topic.EMOTIONS, f"حالِ {name} این هفته بیشتر «{mood}» بوده"))
    days = week.get("active_days_of_7", 0)
    if not facts.get("played_this_week"):
        out.append((Topic.HABITS, f"{name} این هفته هنوز بازی نکرده"))
    elif days <= 2:
        out.append((Topic.HABITS, f"{name} این هفته فقط {fa_digits(days)} روز بازی کرد"))
    if late >= 30:
        out.append((Topic.SCREEN, "زمانِ بازی را می‌شود به ساعتِ بهتری برد"))
    if not out:
        out.append((Topic.EMOTIONS, f"{name} هفته‌ی خوبی داشت؛ تشویقِ درست ادامه‌اش را آسان می‌کند"))
        out.append((Topic.FAMILY, "همراهیِ شما بخشی از همین پیشرفت است"))
    return out


def picks_for(child, items: list[LearnItem], done_ids: set[int], limit: int = 3) -> list[tuple[LearnItem, str]]:
    """برای هر دلیل، بهترین محتوای نخوانده‌ی همان موضوع (برگزیده‌ها اول)"""
    chosen: list[tuple[LearnItem, str]] = []
    used: set[int] = set()
    for topic, why in reasons_for(child):
        candidates = [i for i in items if i.topic == topic and i.id not in used]
        candidates.sort(key=lambda i: (i.id in done_ids, not i.featured, i.sort, -(i.published_at.timestamp())))
        if candidates:
            chosen.append((candidates[0], why))
            used.add(candidates[0].id)
        if len(chosen) >= limit:
            break
    return chosen
