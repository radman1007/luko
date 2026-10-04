"""
اعلان‌های اشتراک در پنلِ والد (همان فهرستِ اعلان‌ها، با پیوند به صورت‌حساب).

    رو به پایان   از ۷ روز پیش از پایان — پیوند به صورت‌حسابِ تمدید با همان پلنِ آخرین خرید
    تمام شد       تا ۷ روز بعد از پایان — بچه به پلنِ رایگان برگشته
    پرداخت موفق   همان لحظه‌ی تأیید، با کدِ پیگیری

کلیدِ یکتا تاریخِ پایان را دارد: تمدید تاریخ را عوض می‌کند و یادآوریِ دوره‌ی بعد
دوباره ساخته می‌شود، ولی یک دوره هیچ‌وقت دو یادآوری نمی‌گیرد. این اعلان‌ها به
تنظیمِ «هشدارهای فعالیت» بسته نیستند؛ درباره‌ی خودِ حسابِ والدند.
"""
from __future__ import annotations

from datetime import datetime, timedelta

from django.db.models import Max
from django.utils import timezone

from apps.common.fa import fa_date, fa_digits

from .models import Payment
from .services import EXPIRY_NOTICE_DAYS, child_name, renewal_plan, subscription


def subscription_link(child_id, plan_code: str | None = None) -> str:
    link = f"/parent-panel/subscription?child={child_id}"
    return f"{link}&plan={plan_code}" if plan_code else link


def _notification(**fields):
    from apps.parent.models import Notification

    return Notification(kind=Notification.Kind.BILLING, **fields)


def expiry_rows(parent, child, name: str, now: datetime | None = None) -> list:
    """یادآوری‌های «رو به پایان» و «تمام شد» برای یک فرزند (برای sync_notifications)."""
    now = now or timezone.now()
    sub = subscription(child, now)
    plan = renewal_plan(sub)
    link = subscription_link(child.id, plan.code if plan else None)
    if sub.active and sub.expiring_soon:
        end = timezone.localtime(sub.ends_at).date()
        return [_notification(
            user=parent, child=child, link=link,
            title=f"اشتراکِ {name} رو به پایان است",
            body=f"{fa_digits(sub.days_left)} روزِ دیگر (تا {fa_date(end)}) تمام می‌شود؛ "
                 f"با یک ضربه تمدیدش کنید.",
            dedup_key=f"sub-ending:{child.id}:{end.isoformat()}",
        )]
    if not sub.active:
        last_end = Payment.objects.filter(child=child, status=Payment.Status.PAID) \
            .aggregate(end=Max("ends_at"))["end"]
        if last_end and now - last_end <= timedelta(days=EXPIRY_NOTICE_DAYS):
            end = timezone.localtime(last_end).date()
            return [_notification(
                user=parent, child=child, link=link,
                title=f"اشتراکِ {name} تمام شد",
                body="حالا روی پلنِ رایگان است؛ برای ادامه‌ی اشتراک تمدیدش کنید.",
                dedup_key=f"sub-ended:{child.id}:{end.isoformat()}",
            )]
    return []


def payment_succeeded(payment: Payment) -> None:
    """اعلانِ «اشتراک فعال شد» برای پرداخت‌کننده و همه‌ی والدهای همان بچه."""
    from apps.parent.models import Notification, ParentChild

    if not payment.child_id or payment.status != Payment.Status.PAID:
        return
    parents = set(ParentChild.objects.filter(child_id=payment.child_id, is_active=True)
                  .values_list("parent_id", flat=True))
    if payment.payer_id:
        parents.add(payment.payer_id)
    name = payment.child_name or child_name(payment.child)
    end = timezone.localtime(payment.ends_at).date()
    tracking = f" · کدِ پیگیری {fa_digits(payment.trans_id)}" if payment.trans_id else ""
    Notification.objects.bulk_create([
        _notification(
            user_id=parent_id, child_id=payment.child_id,
            link=subscription_link(payment.child_id),
            title=f"اشتراکِ {payment.plan_title} {name} فعال شد",
            body=f"تا {fa_date(end, with_year=True)} فعال است{tracking}",
            dedup_key=f"payment:{payment.id}",
        )
        for parent_id in parents
    ], ignore_conflicts=True)
