"""
داده‌ای که اپِ بچه فقط در کلیدهای هم‌رسان می‌گذارد ولی پنلِ والد از جدول‌های سرور می‌خواند.

اپِ اندرویدی یک نسخه‌ی بسته‌شده‌ی فرانت است و تا بیلدِ تازه نصب نشود همان رفتارِ قدیمی را دارد؛ حال، تنفس و
گوش‌دادن را یا اصلاً به سرور نمی‌فرستد یا ممکن است درخواستش گم شود. بعد از هر POSTِ /sync همین‌ها از
کلیدهای تازه برداشته و (بی تکرار) ثبت می‌شوند — مأموریت‌ها و ورزش را گزارش مستقیم از همین داده می‌خواند
(apps.club.synced).
"""
from __future__ import annotations

import logging

from django.db import transaction

from apps.content.services import SYNC_LISTENED_KEY, record_synced_listens
from apps.health.services import (SYNC_DAY_DONE_RE, SYNC_MOOD_KEY, SYNC_MOOD_TIME_KEY, record_synced_breathing,
                                  record_synced_mood)

logger = logging.getLogger(__name__)


def record_from_sync(user, keys: set[str]) -> None:
    """`keys`: کلیدهایی که همین درخواست نوشت. خطای اینجا نباید جوابِ هم‌رسانی را خراب کند."""
    steps = []
    if keys & {SYNC_MOOD_KEY, SYNC_MOOD_TIME_KEY}:
        steps.append(("mood", lambda: record_synced_mood(user)))
    if any(SYNC_DAY_DONE_RE.match(key) for key in keys):
        steps.append(("breathing", lambda: record_synced_breathing(user, keys)))
    if SYNC_LISTENED_KEY in keys:
        steps.append(("podcast", lambda: record_synced_listens(user)))
    for name, step in steps:
        try:
            # savepoint: خطای پایگاه‌داده در یک گام بقیه‌ی درخواست را از کار نیندازد
            with transaction.atomic():
                step()
        except Exception:  # noqa: BLE001 — داده‌ی هم‌رسان نوشته شده؛ این فقط ثبتِ کمکی است
            logger.exception("record_from_sync %s failed for user %s", name, user.pk)
