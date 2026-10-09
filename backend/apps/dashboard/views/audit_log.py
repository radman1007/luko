"""گزارشِ فعالیت‌های تیم."""
from datetime import datetime, timedelta

from django.db.models import Q
from django.utils import timezone
from rest_framework.response import Response

from apps.common.fa import parse_jalali

from ..audit import ACTIONS
from ..models import AuditLog
from ..payloads import fa_stamp
from ..security import DashboardView, paginate
from ..segments import normalized_query


class AuditListView(DashboardView):
    """GET ?action=&actor=&q=&from=&to="""

    capability = "audit"

    def get(self, request):
        p = request.query_params
        qs = AuditLog.objects.all()
        if p.get("action") in ACTIONS:
            qs = qs.filter(action=p["action"])
        if str(p.get("actor", "")).isdigit():
            qs = qs.filter(actor_id=int(p["actor"]))
        q = normalized_query(p.get("q", ""))
        if q:
            qs = qs.filter(Q(actor_label__icontains=q) | Q(target_label__icontains=q) | Q(ip__startswith=q))
        start = parse_jalali(p.get("from") or "")
        if start:
            qs = qs.filter(created_at__gte=timezone.make_aware(datetime.combine(start, datetime.min.time())))
        end = parse_jalali(p.get("to") or "")
        if end:
            qs = qs.filter(created_at__lt=timezone.make_aware(datetime.combine(end + timedelta(days=1),
                                                                               datetime.min.time())))
        page, meta = paginate(request, qs.order_by("-created_at"), default=30)
        return Response({"results": [
            {"id": a.id, "action": a.action, "action_label": ACTIONS.get(a.action, a.action),
             "actor": a.actor_label or "—", "actor_id": a.actor_id, "target": a.target_label,
             "target_type": a.target_type, "target_id": a.target_id, "details": a.details,
             "ip": a.ip, "at": fa_stamp(a.created_at)}
            for a in page
        ], **meta})
