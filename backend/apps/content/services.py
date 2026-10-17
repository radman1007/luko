"""ثبتِ گوش‌دادنِ پادکست — مستقیم از پخش‌کننده، یا از فهرستِ «شنیده‌ها» که با حساب هم‌رسان می‌شود."""
from __future__ import annotations

import json

from django.db import transaction
from django.utils import timezone

from .models import Podcast, PodcastListen

#: کلیدِ localStorage که اپِ بچه شناسه‌ی قسمت‌های تا آخر شنیده را در آن می‌گذارد (features/podcast/usePlayer.ts)
SYNC_LISTENED_KEY = "luko_podcast_listened"
MAX_SYNCED_IDS = 500


def record_listen(user, podcast: Podcast, seconds: int) -> PodcastListen:
    """
    پایانِ یک قسمت که پخش‌کننده می‌فرستد. اگر هم‌رسانی امروز همین قسمت را بی‌مدت ثبت کرده
    (record_synced_listens زودتر رسیده)، همان ردیف کامل می‌شود، نه دوتا.
    """
    with transaction.atomic():
        guessed = (PodcastListen.objects.select_for_update()
                   .filter(user=user, podcast=podcast, seconds=0, created_at__date=timezone.localdate())
                   .first())
        if guessed is None:
            return PodcastListen.objects.create(user=user, podcast=podcast, seconds=seconds)
        guessed.seconds = seconds
        guessed.save(update_fields=["seconds", "updated_at"])
        return guessed


def record_synced_listens(user) -> int:
    """
    بعد از هم‌رسانی: قسمتی که در «شنیده‌ها»ی دستگاه هست ولی هیچ‌وقت برای این بچه ثبت نشده (درخواستِ پخش‌کننده
    در راه گم شده) یک گوش‌دادنِ بی‌مدت می‌گیرد تا به پنلِ والد برسد. شناسه‌های غیرعددی («p1»…) قسمت‌های نمونه‌ی
    نسخه‌ی قدیمیِ اپ‌اند و کنار می‌روند. خروجی: تعدادِ ردیفِ ساخته‌شده.
    """
    from apps.sync.models import KidData

    raw = KidData.objects.filter(user=user, key=SYNC_LISTENED_KEY).values_list("value", flat=True).first()
    try:
        ids = json.loads(raw or "[]")
    except ValueError:
        return 0
    if not isinstance(ids, list):
        return 0
    pks = {int(x) for x in ids[:MAX_SYNCED_IDS] if isinstance(x, (str, int)) and str(x).isdigit()}
    if not pks:
        return 0
    known = set(PodcastListen.objects.filter(user=user, podcast_id__in=pks).values_list("podcast_id", flat=True))
    fresh = list(Podcast.objects.filter(pk__in=pks - known).values_list("pk", flat=True))
    PodcastListen.objects.bulk_create([PodcastListen(user=user, podcast_id=pk, seconds=0) for pk in fresh])
    return len(fresh)
