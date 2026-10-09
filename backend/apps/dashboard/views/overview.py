"""نمای کلی و آمارِ بازدید."""
from datetime import datetime, timedelta

from django.db.models import Count, Q, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework.response import Response

from apps.accounts.models import User
from apps.activity.models import ActivitySlot
from apps.activity.services import daily, hourly, online_now, totals
from apps.billing.models import Payment
from apps.common.fa import MONTHS, fa_date, fa_digits, from_jalali, to_jalali
from apps.support.models import Ticket

from .. import capabilities
from ..payloads import counts_by_role, payment_row, rows
from ..security import DashboardView
from ..segments import sub_end_subquery

RANGES = {"24h": 1, "7d": 7, "30d": 30, "90d": 90}


def _day_start(day) -> datetime:
    return timezone.make_aware(datetime.combine(day, datetime.min.time()))


def signups_series(days: int, now: datetime) -> list[dict]:
    first = timezone.localdate(now) - timedelta(days=days - 1)
    found = {}
    for row in (User.objects.filter(date_joined__gte=_day_start(first), is_staff=False)
                .annotate(day=TruncDate("date_joined", tzinfo=timezone.get_current_timezone()))
                .values("day", "role").annotate(n=Count("pk"))):
        found.setdefault(row["day"], {})[row["role"]] = row["n"]
    out = []
    for i in range(days):
        day = first + timedelta(days=i)
        got = found.get(day, {})
        out.append({"label": fa_date(day), "students": got.get(User.Role.STUDENT, 0),
                    "parents": got.get(User.Role.PARENT, 0)})
    return out


def _daily_points(rows_by_platform: dict) -> list[dict]:
    total = rows_by_platform["all"]
    return [{"label": fa_date(r["day"]), "visitors": r["visitors"], "minutes": r["minutes"],
             "avg_minutes": r["avg_minutes"],
             "web": rows_by_platform["web"][i]["visitors"], "android": rows_by_platform["android"][i]["visitors"]}
            for i, r in enumerate(total)]


class OverviewView(DashboardView):
    capability = "stats"

    def get(self, request):
        now = timezone.now()
        today = timezone.localdate(now)
        caps = capabilities.of(request.user)
        counts = counts_by_role()
        series = {p: daily(30, platform=None if p == "all" else p, now=now) for p in ("all", "web", "android")}
        week = totals(now - timedelta(days=7))
        students = User.objects.filter(role=User.Role.STUDENT, is_staff=False).annotate(sub_end=sub_end_subquery())
        jy, jm, _ = to_jalali(today)
        month_start = _day_start(from_jalali(jy, jm, 1))
        sales = Payment.objects.filter(status=Payment.Status.PAID, source=Payment.Source.GATEWAY,
                                       paid_at__gte=month_start).aggregate(total=Sum("amount_toman"), n=Count("pk"))
        data = {
            "users": {
                **counts,
                "new_today": User.objects.filter(is_staff=False, date_joined__gte=_day_start(today)).count(),
                "new_7d": User.objects.filter(is_staff=False, date_joined__gte=now - timedelta(days=7)).count(),
            },
            "online": online_now(now),
            "active": {
                "today": series["all"][-1]["visitors"],
                "today_avg_minutes": series["all"][-1]["avg_minutes"],
                "week": week["visitors"],
                "week_avg_minutes": week["avg_minutes"],
            },
            "subscriptions": {
                "active": students.filter(sub_end__gt=now).count(),
                "expiring": students.filter(sub_end__gt=now, sub_end__lte=now + timedelta(days=7)).count(),
                "month_label": MONTHS[jm - 1],
                "month_sales_toman": sales["total"] or 0,
                "month_paid": sales["n"],
            },
            "tickets": dict(Ticket.objects.aggregate(
                open=Count("pk", filter=Q(status=Ticket.Status.OPEN)),
                answered=Count("pk", filter=Q(status=Ticket.Status.ANSWERED)))),
            "series": {"active": _daily_points(series), "signups": signups_series(30, now)},
            "latest": {},
        }
        if "users_view" in caps:
            newest = list(User.objects.filter(is_staff=False).annotate(sub_end=sub_end_subquery())
                          .order_by("-date_joined")[:6])
            data["latest"]["signups"] = rows(newest, now)
        if "payments" in caps:
            data["latest"]["payments"] = [payment_row(p) for p in Payment.objects.filter(status=Payment.Status.PAID)
                                          .select_related("child", "payer", "granted_by").order_by("-paid_at")[:6]]
        if "tickets" in caps:
            data["latest"]["tickets"] = [
                {"id": t.id, "subject": t.subject, "user": (f"{t.user.first_name} {t.user.last_name}".strip()
                                                            or t.user.phone),
                 "status": t.status, "status_label": t.get_status_display()}
                for t in Ticket.objects.filter(status=Ticket.Status.OPEN).select_related("user")
                .order_by("-updated_at")[:5]
            ]
        return Response(data)


class OnlineView(DashboardView):
    """GET — فقط آنلاین‌ها؛ صفحه هر ۲۰ ثانیه می‌پرسد."""

    capability = "stats"

    def get(self, request):
        return Response(online_now())


class AnalyticsView(DashboardView):
    """GET ?range=24h|7d|30d|90d&platform=all|web|android&audience=all|student|parent|guest"""

    capability = "stats"

    def get(self, request):
        now = timezone.now()
        span = request.query_params.get("range", "7d")
        days = RANGES.get(span, 7)
        platform = request.query_params.get("platform")
        platform = platform if platform in ActivitySlot.Platform.values else None
        audience = request.query_params.get("audience")
        audience = audience if audience in ActivitySlot.Audience.values else None

        if span == "24h":
            since = now - timedelta(hours=24)
            parts = {p: hourly(24, platform=None if p == "all" else p, audience=audience, now=now)
                     for p in ("all", "web", "android")}
            series = [{"label": fa_digits(timezone.localtime(r["at"]).strftime("%H:00")),
                       "visitors": r["visitors"], "minutes": r["minutes"],
                       "avg_minutes": round(r["minutes"] / r["visitors"], 1) if r["visitors"] else 0,
                       "web": parts["web"][i]["visitors"], "android": parts["android"][i]["visitors"]}
                      for i, r in enumerate(parts["all"])]
        else:
            first = timezone.localdate(now) - timedelta(days=days - 1)
            since = _day_start(first)
            series = _daily_points({p: daily(days, platform=None if p == "all" else p, audience=audience, now=now)
                                    for p in ("all", "web", "android")})

        # ساعت‌های شلوغِ روز در همین بازه (میانگینِ فعال‌ها در هر ساعتِ تهران)
        by_hour = [0] * 24
        slots = (ActivitySlot.objects.filter(hour__gte=since)
                 .values("hour").annotate(v=Count("visitor", distinct=True)))
        if platform:
            slots = slots.filter(platform=platform)
        if audience:
            slots = slots.filter(audience=audience)
        for row in slots:
            by_hour[timezone.localtime(row["hour"]).hour] += row["v"]
        divisor = max(1, days)
        hours_of_day = [{"label": fa_digits(f"{h:02d}"), "visitors": round(v / divisor, 1)} for h, v in enumerate(by_hour)]

        return Response({
            "range": span,
            "online": online_now(now),
            "totals": totals(since, platform=platform, audience=audience),
            "by_platform": {p: totals(since, platform=p, audience=audience) for p in ("web", "android")},
            "by_audience": {a: totals(since, platform=platform, audience=a) for a in ("student", "parent", "guest")},
            "series": series,
            "hours_of_day": hours_of_day,
            "signups": signups_series(days, now) if span != "24h" else [],
        })
