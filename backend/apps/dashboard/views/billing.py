"""پرداخت‌ها و اشتراکِ هدیه."""
from datetime import datetime, timedelta

from django.db.models import Count, Q, Sum
from django.utils import timezone
from rest_framework.response import Response

from apps.accounts.models import User
from apps.billing.models import Payment
from apps.billing.services import CheckoutError, gift_subscription, revoke_gift
from apps.common.fa import parse_jalali

from .. import audit
from ..payloads import full_name, payment_row
from ..security import DashboardView, error, paginate
from ..segments import normalized_query


def _day(text):
    day = parse_jalali(text or "")
    return timezone.make_aware(datetime.combine(day, datetime.min.time())) if day else None


class PaymentListView(DashboardView):
    """GET ?status=&source=&plan=&q=&from=&to=&child="""

    capability = "payments"

    def get(self, request):
        p = request.query_params
        qs = Payment.objects.select_related("child", "payer", "granted_by", "plan").order_by("-created_at")
        if p.get("status") in Payment.Status.values:
            qs = qs.filter(status=p["status"])
        if p.get("source") in Payment.Source.values:
            qs = qs.filter(source=p["source"])
        if p.get("plan"):
            qs = qs.filter(plan__code=p["plan"])
        if str(p.get("child", "")).isdigit():
            qs = qs.filter(child_id=int(p["child"]))
        start, end = _day(p.get("from")), _day(p.get("to"))
        if start:
            qs = qs.filter(created_at__gte=start)
        if end:
            qs = qs.filter(created_at__lt=end + timedelta(days=1))
        q = normalized_query(p.get("q", ""))
        if q:
            qs = qs.filter(Q(factor_number__icontains=q) | Q(child_name__icontains=q) | Q(payer_phone__contains=q)
                           | Q(payer__phone__contains=q) | Q(child__phone__contains=q) | Q(trans_id__icontains=q))
        summary = qs.aggregate(
            count=Count("pk"),
            paid=Count("pk", filter=Q(status=Payment.Status.PAID, source=Payment.Source.GATEWAY)),
            paid_toman=Sum("amount_toman", filter=Q(status=Payment.Status.PAID, source=Payment.Source.GATEWAY)),
            gifts=Count("pk", filter=Q(source=Payment.Source.GIFT, status=Payment.Status.PAID)),
        )
        summary["paid_toman"] = summary["paid_toman"] or 0
        page, meta = paginate(request, qs)
        return Response({"results": [payment_row(x) for x in page], **meta, "summary": summary})


class GiftView(DashboardView):
    """POST {childId, days, note}"""

    capability = "gifts"

    def post(self, request):
        child = User.objects.filter(pk=request.data.get("child_id") or 0).first()
        if child is None:
            return error("دانش‌آموز پیدا نشد.", 404)
        try:
            days = int(request.data.get("days") or 0)
        except (TypeError, ValueError):
            return error("مدت باید عدد باشد.")
        note = str(request.data.get("note") or "").strip()
        try:
            payment = gift_subscription(child=child, days=days, granted_by=request.user, note=note)
        except CheckoutError as exc:
            return error(exc.message, exc.status)
        audit.record(request, "gift_grant", target=child, target_type="user",
                     target_label=full_name(child) or child.phone, details={"days": days, "note": note,
                                                                            "factor": payment.factor_number})
        return Response(payment_row(payment), status=201)


class RevokeGiftView(DashboardView):
    capability = "gifts"

    def post(self, request, pk):
        payment = Payment.objects.select_related("child").filter(pk=pk).first()
        if payment is None:
            return error("پرداخت پیدا نشد.", 404)
        try:
            revoke_gift(payment)
        except CheckoutError as exc:
            return error(exc.message, exc.status)
        audit.record(request, "gift_revoke", target=payment.child, target_type="user",
                     target_label=payment.child_name, details={"factor": payment.factor_number,
                                                               "days": payment.duration_days})
        return Response(payment_row(payment))
