"""اعلانِ همگانی: پیش‌نمایشِ گیرندگان، ارسال و تاریخچه."""
from django.db.models import Q
from rest_framework.response import Response

from apps.notices.models import Broadcast
from apps.notices.services import reach, send_broadcast

from .. import audit
from ..payloads import fa_stamp, full_name
from ..security import DashboardView, error, paginate
from ..segments import describe, filter_users, normalized_query
from .users import filter_params

ROLE_OF = {Broadcast.Audience.PARENTS: "parent", Broadcast.Audience.STUDENTS: "student"}


def _audience_and_filters(data):
    audience = data.get("audience")
    if audience not in Broadcast.Audience.values:
        return None, None
    raw = data.get("filters") or {}
    params = filter_params(raw if isinstance(raw, dict) else {})
    params["role"] = ROLE_OF[audience]            # گیرنده‌ها فقط از همین گروه
    params["active"] = "true"
    params.pop("order", None)
    return audience, params


class NoticePreviewView(DashboardView):
    """POST {audience, filters} — چند نفر می‌گیرند + چند نامِ نمونه."""

    capability = "notify"

    def post(self, request):
        audience, params = _audience_and_filters(request.data)
        if audience is None:
            return error("گیرندگان را انتخاب کنید.")
        qs = filter_users(params)
        sample = [full_name(u) or u.phone for u in qs.order_by("-date_joined")[:6]]
        return Response({"count": qs.count(), "sample": sample, "label": describe(params)})


class NoticeSendView(DashboardView):
    """POST {audience, filters, title, body, link}"""

    capability = "notify"

    def post(self, request):
        audience, params = _audience_and_filters(request.data)
        if audience is None:
            return error("گیرندگان را انتخاب کنید.")
        title = str(request.data.get("title") or "").strip()
        body = str(request.data.get("body") or "").strip()
        link = str(request.data.get("link") or "").strip()
        if not title:
            return error("عنوانِ اعلان لازم است.")
        if len(title) > 120 or len(body) > 240:
            return error("عنوان حداکثر ۱۲۰ و متن حداکثر ۲۴۰ نویسه.")
        if link and (not link.startswith("/") or link.startswith("//") or len(link) > 200):
            return error("پیوند باید مسیری داخلِ اپ باشد، مثلاً /luko-podcast")
        recipients = filter_users(params)
        if not recipients.exists():
            return error("با این فیلترها هیچ گیرنده‌ای نیست.")
        label = describe(params)
        broadcast = send_broadcast(audience=audience, recipients=recipients, title=title, body=body, link=link,
                                   filters=params, filters_label=label, sent_by=request.user)
        audit.record(request, "notice_send", target=broadcast, target_type="broadcast",
                     details={"audience": audience, "recipients": broadcast.recipients, "filters": label})
        return Response({"id": broadcast.id, "recipients": broadcast.recipients}, status=201)


class NoticeHistoryView(DashboardView):
    """GET ?audience=&q="""

    capability = "notify"

    def get(self, request):
        qs = Broadcast.objects.select_related("sent_by")
        if request.query_params.get("audience") in Broadcast.Audience.values:
            qs = qs.filter(audience=request.query_params["audience"])
        q = normalized_query(request.query_params.get("q", ""))
        if q:
            qs = qs.filter(Q(title__icontains=q) | Q(body__icontains=q))
        page, meta = paginate(request, qs.order_by("-created_at"), default=15)
        results = []
        for b in page:
            seen = reach(b)
            results.append({
                "id": b.id, "audience": b.audience, "audience_label": b.get_audience_display(),
                "title": b.title, "body": b.body, "link": b.link, "filters_label": b.filters_label,
                "recipients": b.recipients, "read": seen["read"],
                "sent_by": full_name(b.sent_by) or (b.sent_by.phone if b.sent_by else ""),
                "at": fa_stamp(b.created_at),
            })
        return Response({"results": results, **meta})
