"""
لایه‌ی cache روی Redis — قلبِ سرعتِ پروژه.

راهبرد: هر خلاصه/نمای گرانِ محاسبه (پروفایل، خلاصه‌ی کلاب، وضعیت باغچه، فهرست‌های
ادمین) یک بار محاسبه و در Redis نگه داشته می‌شود؛ با هر نوشتنِ مرتبط، دقیقاً همان
کلید(ها) باطل می‌شود (invalidation صریح، نه TTL کور). کلیدها فضای‌نام‌بندی‌شده‌اند.
"""
from __future__ import annotations

from collections.abc import Callable
from typing import Any

from django.core.cache import cache

# TTLها (ثانیه) — سقفِ ایمنی اگر جایی invalidate جا افتاد
TTL_SHORT = 60          # داده‌های داغِ لحظه‌ای
TTL_MEDIUM = 5 * 60     # خلاصه‌های کاربر
TTL_LONG = 60 * 60      # فهرست‌های کم‌تغییرِ ادمین (مدال، فروشگاه، قالب مأموریت)


# ---------- کلیدسازها ----------
def user_key(user_id: int, suffix: str) -> str:
    return f"u:{user_id}:{suffix}"


def catalog_key(name: str) -> str:
    return f"catalog:{name}"


# کلیدهای پرکاربرد (یک‌جا تا هماهنگ بمانند)
def profile_key(uid: int) -> str: return user_key(uid, "profile")
def club_summary_key(uid: int) -> str: return user_key(uid, "club:summary")
def club_today_key(uid: int, day: str) -> str: return user_key(uid, f"club:today:{day}")
def garden_key(uid: int) -> str: return user_key(uid, "garden")
def parent_report_key(child_id: int) -> str: return user_key(child_id, "parent:report")
def parent_suggestions_key(child_id: int) -> str: return user_key(child_id, "parent:suggestions")
def game_topics_key() -> str: return catalog_key("game-topics")
def book_catalog_key(grade: str | None = None) -> str:
    return catalog_key(f"books:{grade or 'all'}")


# ---------- helperها ----------
def get_or_set(key: str, producer: Callable[[], Any], timeout: int = TTL_MEDIUM) -> Any:
    """اگر در cache بود بده، وگرنه producer را اجرا، ذخیره و برگردان."""
    value = cache.get(key)
    if value is None:
        value = producer()
        cache.set(key, value, timeout)
    return value


def invalidate(*keys: str) -> None:
    if keys:
        cache.delete_many(list(keys))


def invalidate_user(user_id: int, *suffixes: str) -> None:
    """چند نمای یک کاربر را با هم باطل کن (پس از نوشتن)."""
    invalidate(*(user_key(user_id, s) for s in suffixes))


def invalidate_catalog(name: str) -> None:
    """فهرست ادمینی (مدال/فروشگاه/قالب مأموریت) پس از تغییر باطل می‌شود."""
    invalidate(catalog_key(name))
