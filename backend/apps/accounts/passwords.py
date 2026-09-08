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
    """
    حسابی که هنوز رمز نگذاشته (یا با OTP ساخته شده) رمزِ قابل‌استفاده ندارد.

    خالی‌بودن جدا سنجیده می‌شود چون `has_usable_password` جنگو برای رشته‌ی
    خالی `True` می‌دهد — فقط رمزهای «!»دار را ناموجود می‌شمارد. مسیرِ خودِ
    برنامه همیشه `set_unusable_password` می‌زند، ولی حسابی که از ادمین یا
    شل ساخته شود رمزِ خالی می‌گیرد؛ بدونِ این بررسی چنین حسابی «رمزدار»
    به حساب می‌آمد، حال آنکه هیچ رمزی بازش نمی‌کند.
    """
    return bool(user.password) and user.has_usable_password()


@transaction.atomic
def get_or_create_account(phone: str, role: str, first_name: str = "",
                          grade: int | None = None) -> tuple[User, bool]:
    """
    حسابِ همان شماره و نقش را برمی‌گرداند؛ نبود، می‌سازد.

    نقش جزوِ جستجوست چون یک شماره می‌تواند هم حسابِ دانش‌آموز داشته باشد
    هم والد (بچه‌هایی که با شماره‌ی پدر/مادر ثبت‌نام می‌کنند).

    برای دانش‌آموز، «حسابِ بی‌رمزِ همان شماره» را برمی‌داریم نه هر حسابی:
    یک شماره می‌تواند چند بچه داشته باشد و رمز آن‌ها را از هم جدا می‌کند،
    پس حسابی که قبلاً رمز گذاشته مالِ بچه‌ی دیگری است و نباید دزدیده شود.
    """
    if role == User.Role.STUDENT:
        user = next(
            (u for u in User.objects.filter(phone=phone, role=role) if not has_password(u)),
            None,
        )
        if user is not None:
            if grade is not None and user.grade != grade:
                user.grade = grade
                user.save(update_fields=["grade"])
            return user, False
        user = User(phone=phone, role=role, first_name=first_name or "",
                    grade=grade if grade is not None else 1)
        user.set_unusable_password()
        user.save()
        link_family(user)
        return user, True

    user, created = User.objects.get_or_create(
        phone=phone, role=role,
        defaults={"first_name": first_name or ""},
    )
    if created:
        user.set_unusable_password()
        user.save(update_fields=["password"])
        link_family(user)
    return user, created


def student_by_password(phone: str, raw: str) -> User | None:
    """
    حسابِ دانش‌آموزی که رمزش می‌خورد.

    چون چند بچه می‌توانند یک شماره داشته باشند، رمز تنها چیزی است که
    آن‌ها را از هم جدا می‌کند. تعدادشان در عمل انگشت‌شمار است، پس
    پیمایش هزینه‌ای ندارد.
    """
    for user in User.objects.filter(phone=phone, role=User.Role.STUDENT):
        if has_password(user) and user.check_password(raw):
            return user
    return None


def link_family(user: User) -> None:
    """
    والد و بچه‌ی هم‌شماره را به هم وصل می‌کند.

    بیشترِ بچه‌ها با شماره‌ی پدر/مادرشان ثبت‌نام می‌کنند؛ بدونِ این،
    والد باید همان بچه را دستی هم اضافه می‌کرد و دو تا می‌شد.
    """
    from apps.parent.models import ParentChild

    if user.role == User.Role.STUDENT:
        parents = User.objects.filter(phone=user.phone, role=User.Role.PARENT)
        for parent in parents:
            ParentChild.objects.get_or_create(
                parent=parent, child=user, defaults={"grade": user.grade})
    elif user.role == User.Role.PARENT:
        children = User.objects.filter(phone=user.phone, role=User.Role.STUDENT)
        for child in children:
            ParentChild.objects.get_or_create(
                parent=user, child=child, defaults={"grade": child.grade})


def mark_phone_verified(user: User) -> None:
    user.phone_verified = True
    user.phone_verified_at = timezone.now()
    user.save(update_fields=["phone_verified", "phone_verified_at"])


def account_with_password_exists(phone: str, role: str) -> bool:
    """
    آیا روی این شماره و نقش، حسابی هست که رمز داشته باشد؟

    برای والد یک حساب بیشتر نیست، ولی چند بچه می‌توانند یک شماره داشته
    باشند و بعضی‌شان هنوز رمز نگذاشته باشند. اگر فقط به «اولین حساب»
    نگاه کنیم، بچه‌ای که رمز دارد ممکن است پشتِ حسابِ نیمه‌کاره‌ی دیگری
    پنهان بماند و فرانت او را به ثبت‌نام بفرستد — یعنی راهِ ورود با رمز
    را اصلاً نبیند. پس ملاک «دستِ‌کم یکی» است.

    کسی که هنوز رمز ندارد از همین شماره با کدِ یک‌بارمصرف وارد می‌شود،
    پس چیزی از دست نمی‌رود.
    """
    return any(has_password(u) for u in User.objects.filter(phone=phone, role=role))
