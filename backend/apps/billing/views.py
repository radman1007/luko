"""
APIهای اشتراک — فقط والد، و فقط برای فرزندانِ خودش. بازگشت از درگاه تنها
مسیرِ بی‌احراز است (مرورگر از وندار برمی‌گردد و توکنِ JWT همراهش نیست)؛ آن‌جا
هم هیچ چیز به گفته‌ی مرورگر اعتماد نمی‌شود — وضعیت را خودِ وندار تأیید می‌کند.
"""
from __future__ import annotations

from django.db.models import Q
from django.http import HttpResponseRedirect
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.fa import fa_date, fa_time
from apps.parent.views import IsParent

from . import vandar
from .models import Payment, Plan
from .services import (
    CheckoutError,
    child_name,
    handle_callback,
    is_linked,
    linked_children,
    reconcile,
    renewal_plan,
    start_checkout,
    subscription,
)


def _fa_date(value):
    return fa_date(timezone.localtime(value).date(), with_year=True) if value else ""


def _fa_datetime(value):
    if not value:
        return ""
    local = timezone.localtime(value)
    return f"{fa_date(local.date(), with_year=True)} · {fa_time(local)}"


def _monthly_price() -> int | None:
    monthly = Plan.objects.filter(is_active=True, duration_days__lte=31).order_by("duration_days").first()
    return monthly.price_toman if monthly else None


def plan_payload(plan: Plan, monthly: int | None) -> dict:
    months = max(1, round(plan.duration_days / 30))
    saving = 0
    if monthly and months > 1:
        full = monthly * months
        saving = max(0, round(100 * (full - plan.price_toman) / full))
    return {
        "code": plan.code,
        "title": plan.title,
        "duration_days": plan.duration_days,
        "months": months,
        "price_toman": plan.price_toman,
        "per_month_toman": round(plan.price_toman / months),
        "saving_percent": saving,
    }


def status_payload(child) -> dict:
    sub = subscription(child)
    renew = renewal_plan(sub)
    current = sub.plan
    return {
        "child_id": str(child.id),
        "child_name": child_name(child),
        "status": "active" if sub.active else "free",
        "plan_code": current.plan.code if current else None,
        "plan_title": current.plan_title if current else "رایگان",
        "starts_at": sub.chain_start.isoformat() if sub.chain_start else None,
        "ends_at": sub.ends_at.isoformat() if sub.ends_at else None,
        "ends_at_fa": _fa_date(sub.ends_at),
        "days_left": sub.days_left,
        "total_days": sub.total_days,
        "expiring_soon": sub.expiring_soon,
        "renewal": {
            "plan_code": renew.code,
            "plan_title": renew.title,
            "amount_toman": renew.price_toman,
            # تمدید پشتِ دوره‌ی فعلی می‌نشیند؛ روزِ باقی‌مانده نمی‌سوزد
            "starts_from_fa": _fa_date(sub.ends_at) if sub.active else _fa_date(timezone.now()),
        } if renew else None,
    }


def payment_payload(payment: Payment) -> dict:
    return {
        "id": payment.id,
        "factor_number": payment.factor_number,
        "child_id": str(payment.child_id) if payment.child_id else None,
        "child_name": payment.child_name,
        "plan_code": payment.plan.code,
        "plan_title": payment.plan_title,
        "amount_toman": payment.amount_toman,
        "status": payment.status,
        "status_label": "هدیه" if payment.source == Payment.Source.GIFT and payment.status == Payment.Status.PAID
        else payment.get_status_display(),
        "is_gift": payment.source == Payment.Source.GIFT,
        "created_at_fa": _fa_datetime(payment.created_at),
        "paid_at_fa": _fa_datetime(payment.paid_at),
        "trans_id": payment.trans_id,
        "card_number": payment.card_number,
        "starts_at_fa": _fa_date(payment.starts_at),
        "ends_at_fa": _fa_date(payment.ends_at),
        "message": payment.message if payment.status != Payment.Status.PAID else "",
    }


def _error(message: str, code: int) -> Response:
    """همان پاکتِ خطای بقیه‌ی API (پنل `error.message` را نشان می‌دهد)."""
    return Response({"error": {"code": code, "message": message}}, status=code)


def _visible_payments(user):
    """پرداخت‌هایی که این والد می‌بیند: خودش پرداخته، یا برای بچه‌ی متصل به اوست."""
    children = [c.id for c in linked_children(user)]
    return Payment.objects.filter(Q(payer=user) | Q(child_id__in=children)).select_related("plan")


class PlansView(APIView):
    permission_classes = [IsParent]

    def get(self, request):
        monthly = _monthly_price()
        return Response([plan_payload(p, monthly) for p in Plan.objects.filter(is_active=True)])


class ChildrenStatusView(APIView):
    """وضعیتِ اشتراکِ هر فرزند (نشانِ نوار و صفحه‌ی اشتراک)."""

    permission_classes = [IsParent]

    def get(self, request):
        return Response([status_payload(child) for child in linked_children(request.user)])


class PaymentsView(APIView):
    """صورت‌حساب‌ها؛ ?child=<id> فقط همان فرزند."""

    permission_classes = [IsParent]

    def get(self, request):
        rows = _visible_payments(request.user).exclude(status=Payment.Status.PENDING, token__isnull=True)
        child = request.query_params.get("child")
        if child:
            rows = rows.filter(child_id=child)
        return Response([payment_payload(p) for p in rows[:50]])


class PaymentDetailView(APIView):
    """یک پرداخت (صفحه‌ی نتیجه). ?refresh=1 پرداختِ pending را با وندار پیگیری می‌کند."""

    permission_classes = [IsParent]

    def get(self, request, pk):
        payment = _visible_payments(request.user).filter(pk=pk).first()
        if payment is None:
            return _error("این صورت‌حساب پیدا نشد.", status.HTTP_404_NOT_FOUND)
        if payment.status == Payment.Status.PENDING and request.query_params.get("refresh"):
            payment = reconcile(payment.id) or payment
        return Response(payment_payload(payment))


class CheckoutView(APIView):
    """POST {childId, plan} → {paymentId, payUrl}؛ مرورگر به payUrl (درگاهِ وندار) می‌رود."""

    permission_classes = [IsParent]

    def post(self, request):
        child = is_linked(request.user, request.data.get("child_id"))
        if child is None:
            return _error("این فرزند به حسابِ شما وصل نیست.", status.HTTP_404_NOT_FOUND)
        plan = Plan.objects.filter(code=request.data.get("plan"), is_active=True).first()
        if plan is None:
            return _error("پلنِ انتخاب‌شده پیدا نشد.", status.HTTP_400_BAD_REQUEST)
        try:
            payment = start_checkout(request.user, child, plan)
        except CheckoutError as exc:
            return _error(exc.message, exc.status)
        return Response({
            "payment_id": payment.id,
            "factor_number": payment.factor_number,
            "amount_toman": payment.amount_toman,
            "pay_url": vandar.pay_url(payment.token),
        }, status=status.HTTP_201_CREATED)


class CallbackView(APIView):
    """بازگشتِ مرورگر از وندار (?token=…&payment_status=OK|FAILED) → صفحه‌ی نتیجه."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def _handle(self, request):
        params = request.query_params if request.method == "GET" else request.data
        token = str(params.get("token") or "").strip()[:128]
        payment = handle_callback(token, str(params.get("payment_status") or "").upper())
        return HttpResponseRedirect(_result_url(payment))

    def get(self, request):
        return self._handle(request)

    def post(self, request):
        return self._handle(request)


def _result_url(payment):
    from .services import result_url

    return result_url(payment, "" if payment else "unknown")

