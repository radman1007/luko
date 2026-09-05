"""
ثبت‌نام و ورود با شماره و رمز.

تأییدِ شماره فعلاً شرطِ ورود نیست: کاربر شماره‌اش را می‌زند، حساب ساخته
می‌شود و بعد رمز می‌گذارد. تأیید کارِ اختیاریِ بعدی است که از پنل انجام
می‌دهد. هر بار که رمز عوض می‌شود، نسخه‌ی رمزنگاری‌شده‌ی گاوصندوق هم
به‌روز می‌شود تا پشتیبانی بتواند کمکش کند.
"""
from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from .models import PasswordVault, User

MIN_PASSWORD = 6


@transaction.atomic
def set_password(user: User, raw: str) -> None:
    """رمز را هم برای احراز هویت (هَش) و هم برای پشتیبانی (رمزنگاری‌شده) می‌نویسد."""
    user.set_password(raw)
    user.save(update_fields=["password"])
    vault, _ = PasswordVault.objects.get_or_create(user=user)
    vault.set_password(raw)
    vault.save(update_fields=["sealed", "updated_at"])


def has_password(user: User) -> bool:
    """حسابی که هنوز رمز نگذاشته (یا با OTP ساخته شده) رمزِ قابل‌استفاده ندارد."""
    return user.has_usable_password()


@transaction.atomic
def get_or_create_account(phone: str, role: str, first_name: str = "") -> tuple[User, bool]:
    """
    حسابِ همان شماره و نقش را برمی‌گرداند؛ نبود، می‌سازد.

    نقش جزوِ جستجوست چون یک شماره می‌تواند هم حسابِ دانش‌آموز داشته باشد
    هم والد (بچه‌هایی که با شماره‌ی پدر/مادر ثبت‌نام می‌کنند).
    """
    user, created = User.objects.get_or_create(
        phone=phone, role=role,
        defaults={"first_name": first_name or ""},
    )
    if created:
        user.set_unusable_password()
        user.save(update_fields=["password"])
    return user, created


def mark_phone_verified(user: User) -> None:
    user.phone_verified = True
    user.phone_verified_at = timezone.now()
    user.save(update_fields=["phone_verified", "phone_verified_at"])
