"""
منطقِ اشتراک و پرداخت — تنها جایی که وضعیتِ پرداخت عوض می‌شود.

چرخه‌ی یک پرداخت:

    start_checkout   ردیفِ pending + توکنِ وندار → آدرسِ درگاه
    handle_callback  بازگشتِ مرورگر از درگاه → settle
    settle           verify؛ اگر پاسخِ verify گم شده بود (دومی خطا می‌دهد)، transaction
                     با code=2 نشان می‌دهد که پول تأیید شده → activate
    reconcile        کارِ زمان‌بندی‌شده: پرداختی که مرورگرش برنگشت (بسته شد، اینترنت قطع شد)
                     با transaction پیگیری و در صورتِ لزوم تأیید می‌شود

قفل‌ها: هر تغییرِ وضعیت داخلِ `select_for_update` روی همان پرداخت است، پس بازگشتِ
دوباره از درگاه یا هم‌زمانیِ بازگشت و reconcile پرداخت را دوبار ثبت نمی‌کند؛ فعال‌سازی
روی ردیفِ خودِ بچه هم قفل می‌گیرد تا دو خریدِ هم‌زمان دوره‌ها را روی هم نیندازند.
پول فقط وقتی «پرداخت‌شده» است که وندار بگوید تأیید شده **و** مبلغ همان باشد که ما خواستیم.
"""
from __future__ import annotations

import logging
import math
import re
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta

from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models import Max
from django.utils import timezone

from apps.accounts.models import User

from . import vandar
from .models import Payment, Plan

log = logging.getLogger("luko.billing")

DAY = timedelta(days=1)
#: یادآوریِ تمدید از چند روز پیش از پایان
EXPIRY_NOTICE_DAYS = 7
#: پرداختی که مرورگرش برنگشته، پیش از این‌که reconcile سراغش برود (کاربر هنوز در درگاه است)
RECONCILE_AFTER = timedelta(minutes=2)
#: وندار تا ۲۰ دقیقه بعد از رفتن به درگاه تأیید می‌پذیرد؛ با کمی حاشیه
GATEWAY_WINDOW = timedelta(minutes=25)
#: سقفِ پرداختِ نیمه‌کاره‌ی هم‌زمانِ یک والد (جلوی ساختنِ انبوهِ تراکنش را می‌گیرد)
MAX_PENDING_PER_HOUR = 10

_MOBILE = re.compile(r"^09\d{9}$")


class CheckoutError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message = message
        self.status = status


# ------------------------------------------------------------------ وضعیت
@dataclass
class Subscription:
    active: bool
    plan: Payment | None          # دوره‌ای که همین حالا جاری است
    ends_at: datetime | None      # پایانِ کلِ اشتراکِ پرداخت‌شده (با دوره‌های پشتِ‌سرِ هم)
    chain_start: datetime | None  # شروعِ دوره‌ی جاری (برای نوارِ پیشرفت)
    days_left: int
    total_days: int
    last_paid: Payment | None     # آخرین خرید — مبنای صورت‌حسابِ تمدید

    @property
    def expiring_soon(self) -> bool:
        return self.active and self.days_left <= EXPIRY_NOTICE_DAYS


def subscription(child: User, now: datetime | None = None) -> Subscription:
    now = now or timezone.now()
    paid = list(Payment.objects.filter(child=child, status=Payment.Status.PAID,
                                       ends_at__isnull=False).select_related("plan"))
    last_paid = max(paid, key=lambda p: p.paid_at or p.created_at, default=None)
    future = [p for p in paid if p.ends_at > now]
    if not future:
        return Subscription(False, None, None, None, 0, 0, last_paid)
    ends_at = max(p.ends_at for p in future)
    current = next((p for p in sorted(future, key=lambda p: p.starts_at) if p.starts_at <= now), None)
    current = current or min(future, key=lambda p: p.starts_at)
    chain_start = min(current.starts_at, now)
    days_left = max(1, math.ceil((ends_at - now) / DAY))
    total_days = max(days_left, math.ceil((ends_at - chain_start) / DAY))
    return Subscription(True, current, ends_at, chain_start, days_left, total_days, last_paid)


def renewal_plan(sub: Subscription) -> Plan | None:
    """صورت‌حسابِ تمدید: همان پلنی که آخرین بار خریده شد (اگر هنوز فروخته می‌شود)."""
    if sub.last_paid is None:
        return None
    plan = sub.last_paid.plan
    return plan if plan.is_active else None


def linked_children(parent: User):
    from apps.parent.models import ParentChild

    return [link.child for link in ParentChild.objects.filter(parent=parent, is_active=True)
            .select_related("child").order_by("created_at")]


def is_linked(parent: User, child_id) -> User | None:
    from apps.parent.models import ParentChild

    link = ParentChild.objects.filter(parent=parent, child_id=child_id, is_active=True) \
        .select_related("child").first()
    return link.child if link else None


def child_name(child: User | None) -> str:
    if child is None:
        return ""
    return f"{child.first_name} {child.last_name}".strip() or child.phone


# ------------------------------------------------------------------ پرداخت
def callback_url() -> str:
    return settings.SITE_URL.rstrip("/") + "/api/v1/billing/callback"


def result_url(payment: Payment | None, problem: str = "") -> str:
    base = settings.SITE_URL.rstrip("/") + "/parent-panel/subscription/result"
    if payment is None:
        return f"{base}?error={problem or 'unknown'}"
    return f"{base}?payment={payment.id}"


def _factor_number() -> str:
    return f"LK{timezone.localtime():%y%m%d}{secrets.randbelow(10**6):06d}"


def start_checkout(parent: User, child: User, plan: Plan) -> Payment:
    if not plan.is_active:
        raise CheckoutError("این پلن دیگر فروخته نمی‌شود.")
    recent = Payment.objects.filter(payer=parent, status=Payment.Status.PENDING,
                                    created_at__gte=timezone.now() - timedelta(hours=1)).count()
    if recent >= MAX_PENDING_PER_HOUR:
        raise CheckoutError("چند پرداختِ نیمه‌کاره دارید؛ چند دقیقه‌ی دیگر دوباره تلاش کنید.", 429)

    name = child_name(child)
    for _ in range(5):
        try:
            payment = Payment.objects.create(
                payer=parent, child=child, plan=plan, plan_title=plan.title,
                duration_days=plan.duration_days, amount_toman=plan.price_toman,
                amount_rial=plan.price_rial, payer_phone=parent.phone, child_name=name,
                factor_number=_factor_number(),
            )
            break
        except IntegrityError:          # شماره‌ی فاکتورِ تکراری؛ بسیار نادر
            continue
    else:
        raise CheckoutError("ساختِ صورت‌حساب انجام نشد؛ دوباره تلاش کنید.", 500)

    try:
        token = vandar.send(
            amount_rial=payment.amount_rial,
            callback_url=callback_url(),
            factor_number=payment.factor_number,
            description=f"اشتراکِ {plan.title} لوکو — {name}",
            mobile=parent.phone if _MOBILE.match(parent.phone or "") else "",
        )
    except vandar.VandarError as exc:
        log.warning("checkout %s: send failed: %s", payment.factor_number, exc.message)
        Payment.objects.filter(pk=payment.pk).update(status=Payment.Status.FAILED,
                                                     message=exc.message[:255])
        raise CheckoutError(
            "درگاهِ پرداخت الان در دسترس نیست؛ چند دقیقه‌ی دیگر دوباره تلاش کنید."
            if exc.transient else "درگاهِ پرداخت درخواست را نپذیرفت؛ با پشتیبانی تماس بگیرید.",
            503 if exc.transient else 502,
        ) from exc
    payment.token = token
    payment.save(update_fields=["token", "updated_at"])
    return payment


def _amount_matches(payment: Payment, data: dict) -> bool:
    try:
        return round(float(data.get("amount"))) == payment.amount_rial
    except (TypeError, ValueError):
        return False


def _mark(payment: Payment, status: str, message: str, data: dict | None = None) -> None:
    payment.status = status
    payment.message = message[:255]
    if data:
        payment.gateway_response = data
    payment.save(update_fields=["status", "message", "gateway_response", "updated_at"])


def _activate(payment: Payment, data: dict) -> None:
    """پرداختِ تأییدشده → دوره‌ی اشتراک (پشتِ دوره‌ی جاری، اگر هست)."""
    now = timezone.now()
    if payment.child_id:
        # دو خریدِ هم‌زمان برای یک بچه نباید هر دو «از همین حالا» شروع شوند
        User.objects.select_for_update().filter(pk=payment.child_id).first()
    current_end = Payment.objects.filter(
        child_id=payment.child_id, status=Payment.Status.PAID, ends_at__gt=now,
    ).exclude(pk=payment.pk).aggregate(end=Max("ends_at"))["end"]
    start = max(now, current_end) if current_end else now
    payment.status = Payment.Status.PAID
    payment.paid_at = now
    payment.starts_at = start
    payment.ends_at = start + timedelta(days=payment.duration_days)
    payment.trans_id = str(data.get("transId") or "")[:40]
    payment.card_number = str(data.get("cardNumber") or "")[:32]
    payment.message = str(data.get("message") or "پرداخت تأیید شد")[:255]
    payment.gateway_response = data
    payment.save()
    log.info("payment %s paid: %s rial, child %s until %s", payment.factor_number,
             payment.amount_rial, payment.child_id, payment.ends_at)
    # همان تراکنش: اگر ثبتِ پرداخت برگردد، اعلانِ «فعال شد» هم برمی‌گردد
    from .notices import payment_succeeded

    payment_succeeded(payment)


def settle(payment: Payment) -> None:
    """
    پرداختِ pending را با وندار تمام می‌کند. باید داخلِ تراکنش و با قفل روی
    همان ردیف صدا زده شود. خطای موقتِ شبکه پرداخت را pending نگه می‌دارد تا
    reconcile دوباره سراغش برود — هیچ‌وقت به‌خاطرِ قطعیِ شبکه «ناموفق» نمی‌شود.
    """
    if payment.status != Payment.Status.PENDING or not payment.token:
        return
    payment.verify_attempts += 1
    payment.save(update_fields=["verify_attempts", "updated_at"])
    try:
        data = vandar.verify(payment.token)
    except vandar.VandarError as exc:
        if exc.transient:
            return
        data = None
        verify_error = exc
    else:
        verify_error = None
    if data is not None:
        if _amount_matches(payment, data):
            _activate(payment, data)
        else:
            log.error("payment %s: AMOUNT MISMATCH verify=%s expected=%s", payment.factor_number,
                      data.get("amount"), payment.amount_rial)
            _mark(payment, Payment.Status.FAILED, "مبلغِ تأییدشده با صورت‌حساب نمی‌خواند", data)
        return

    # verify رد کرد: یا پرداخت نشده، یا قبلاً تأیید شده و پاسخش به ما نرسیده بود
    try:
        info = vandar.transaction(payment.token)
    except vandar.VandarError as exc:
        if exc.transient:
            return
        info = exc.data
    code = info.get("code") if isinstance(info, dict) else None
    if code == vandar.CODE_CONFIRMED and _amount_matches(payment, info):
        _activate(payment, info)
    elif code == vandar.CODE_AWAITING and timezone.now() - payment.created_at < GATEWAY_WINDOW:
        return        # هنوز در مهلتِ درگاه؛ دورِ بعد
    elif code == vandar.CODE_EXPIRED or code == vandar.CODE_AWAITING:
        _mark(payment, Payment.Status.EXPIRED, "مهلتِ پرداخت تمام شد", info)
    else:
        _mark(payment, Payment.Status.FAILED,
              (verify_error.message if verify_error else "") or "پرداخت انجام نشد", info or {})


def _settle_failed_return(payment: Payment) -> None:
    """
    بانک «ناموفق» برگرداند (لغو، موجودیِ ناکافی، رمزِ غلط…). اگر وندار با این
    حال پول را تأییدشده یا منتظرِ تأیید می‌داند، همین حالا یک‌بار تأیید می‌کنیم؛
    وگرنه پرداخت فوراً «ناموفق» است — والدی که لغو کرده نباید پشتِ «در حالِ بررسی» بماند.
    """
    try:
        info = vandar.transaction(payment.token)
    except vandar.VandarError as exc:
        info = exc.data if not exc.transient else {}
    code = info.get("code") if isinstance(info, dict) else None
    if code == vandar.CODE_CONFIRMED and _amount_matches(payment, info):
        _activate(payment, info)
        return
    if code == vandar.CODE_AWAITING:
        try:
            data = vandar.verify(payment.token)
        except vandar.VandarError as exc:
            if exc.transient:
                return          # شبکه قطع شد؛ reconcile ادامه می‌دهد
        else:
            if _amount_matches(payment, data):
                _activate(payment, data)
                return
    _mark(payment, Payment.Status.FAILED, "پرداخت انجام نشد یا لغو شد", info or {})


def handle_callback(token: str, payment_status: str) -> Payment | None:
    """بازگشتِ مرورگر از درگاه. چندبار صدا زدنش بی‌خطر است."""
    if not token:
        return None
    with transaction.atomic():
        payment = Payment.objects.select_for_update().filter(token=token).first()
        if payment is None:
            log.warning("callback for unknown token")
            return None
        if payment.status != Payment.Status.PENDING:
            return payment
        if payment_status == "OK":
            settle(payment)
        else:
            _settle_failed_return(payment)
    payment.refresh_from_db()
    return payment


def reconcile(payment_id: int) -> Payment | None:
    """پیگیریِ یک پرداختِ pending (کارِ زمان‌بندی‌شده و صفحه‌ی نتیجه)."""
    with transaction.atomic():
        payment = Payment.objects.select_for_update().filter(pk=payment_id).first()
        if payment is None or payment.status != Payment.Status.PENDING:
            return payment
        age = timezone.now() - payment.created_at
        if not payment.token:
            if age > timedelta(minutes=10):
                _mark(payment, Payment.Status.FAILED, "ساختِ پرداخت ناتمام ماند")
            return payment
        if age < RECONCILE_AFTER:
            return payment
        try:
            info = vandar.transaction(payment.token)
        except vandar.VandarError as exc:
            if exc.transient:
                return payment
            info = exc.data
        code = info.get("code") if isinstance(info, dict) else None
        if code in (vandar.CODE_AWAITING, vandar.CODE_CONFIRMED):
            if code == vandar.CODE_CONFIRMED and _amount_matches(payment, info):
                _activate(payment, info)
            else:
                settle(payment)
        elif code == vandar.CODE_EXPIRED or (code is None and age > timedelta(hours=2)):
            _mark(payment, Payment.Status.EXPIRED, "مهلتِ پرداخت تمام شد", info or {})
        elif code in (vandar.CODE_WRONG, vandar.CODE_FAILED):
            # «پرداخت‌نشده» در مهلتِ درگاه یعنی کاربر هنوز روی صفحه‌ی بانک است
            if age > GATEWAY_WINDOW:
                _mark(payment, Payment.Status.FAILED, "پرداخت انجام نشد", info)
    payment.refresh_from_db()
    return payment
