"""
GET/POST /sync — همگام‌سازیِ داده‌ی دستگاه بینِ دستگاه‌های یک حساب.

GET  /sync?since=<iso>  همه‌ی کلیدهایی که بعد از `since` عوض شده‌اند (بی since: همه)
POST /sync {changes: [{key, value, baseVersion}]}
     هر کلید فقط وقتی نوشته می‌شود که `baseVersion` همان نسخه‌ی فعلیِ سرور باشد؛
     وگرنه مقدارِ فعلیِ سرور در `conflicts` برمی‌گردد تا دستگاه ادغام کند و دوباره
     بفرستد. این‌طوری دو دستگاه بی‌خبر روی کارِ هم نمی‌نویسند.
"""
import re
from datetime import timedelta

from django.db import IntegrityError, transaction
from django.db.models import Sum
from django.db.models.functions import Length
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import status
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.health.services import SYNC_MOOD_KEY, SYNC_MOOD_TIME_KEY, record_synced_mood

from .models import KidData

KEY_RE = re.compile(r"^[A-Za-z0-9_.:\-]{1,120}$")
MAX_VALUE = 256 * 1024          # ذخیره‌ی بزرگ‌ترین بازی چند ده کیلوبایت است
MAX_CHANGES = 200
MAX_TOTAL = 5 * 1024 * 1024     # سقفِ کلِ داده‌ی یک حساب
# نوشتنی که هم‌زمان با خواندن کامیت شود نباید از `since`ِ بعدی جا بماند
SINCE_OVERLAP = timedelta(seconds=10)


class IsStudent(BasePermission):
    """فقط حسابِ بچه داده‌ی دستگاه دارد."""

    def has_permission(self, request, view):
        return getattr(request.user, "role", None) == User.Role.STUDENT


def _bad(message: str, code: int = status.HTTP_400_BAD_REQUEST) -> Response:
    return Response({"error": {"code": code, "message": message}}, status=code)


class AccountSyncView(APIView):
    permission_classes = [IsAuthenticated, IsStudent]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "sync"

    def get(self, request):
        now = timezone.now()
        rows = KidData.objects.filter(user=request.user)
        raw = request.query_params.get("since")
        if raw:
            since = parse_datetime(raw)
            if since is None:
                return _bad("since معتبر نیست.")
            rows = rows.filter(updated_at__gt=since)
        items = [{"key": r.key, "value": r.value, "version": r.version} for r in rows.order_by("key")]
        return Response({"since": (now - SINCE_OVERLAP).isoformat(), "items": items})

    def post(self, request):
        changes = request.data.get("changes") if isinstance(request.data, dict) else None
        if not isinstance(changes, list) or not changes:
            return _bad("changes باید فهرستِ غیرخالی باشد.")
        if len(changes) > MAX_CHANGES:
            return _bad(f"در هر درخواست حداکثر {MAX_CHANGES} کلید.")

        seen = set()
        clean = []
        for change in changes:
            if not isinstance(change, dict):
                return _bad("هر تغییر باید شیء باشد.")
            key, value, base = change.get("key"), change.get("value"), change.get("base_version")
            if not isinstance(key, str) or not KEY_RE.match(key):
                return _bad("کلید معتبر نیست.")
            if key in seen:
                return _bad("کلیدِ تکراری در یک درخواست.")
            seen.add(key)
            if value is not None and (not isinstance(value, str) or len(value) > MAX_VALUE):
                return _bad("مقدار باید متن و کوچک‌تر از سقف باشد.")
            if not isinstance(base, int) or isinstance(base, bool) or base < 0:
                return _bad("baseVersion معتبر نیست.")
            clean.append((key, value, base))

        try:
            with transaction.atomic():
                applied, conflicts = self._apply(request.user, clean)
                total = (KidData.objects.filter(user=request.user)
                         .aggregate(size=Sum(Length("value")))["size"] or 0)
                if total > MAX_TOTAL:
                    raise _QuotaExceeded
        except _QuotaExceeded:
            return _bad("حجمِ داده‌ی این حساب از سقف گذشت.", status.HTTP_413_REQUEST_ENTITY_TOO_LARGE)
        except IntegrityError:
            # دو دستگاه هم‌زمان کلیدِ تازه‌ای ساختند؛ دستگاه دوباره می‌خواند و می‌فرستد
            return _bad("هم‌زمان از جای دیگری نوشته شد؛ دوباره امتحان کن.", status.HTTP_409_CONFLICT)

        if {row["key"] for row in applied} & {SYNC_MOOD_KEY, SYNC_MOOD_TIME_KEY}:
            record_synced_mood(request.user)
        return Response({"applied": applied, "conflicts": conflicts})

    @staticmethod
    def _apply(user, changes):
        rows = {r.key: r for r in KidData.objects.select_for_update()
                .filter(user=user, key__in=[key for key, _v, _b in changes])}
        applied, conflicts = [], []
        for key, value, base in changes:
            row = rows.get(key)
            current = row.version if row else 0
            if base != current:
                conflicts.append({"key": key, "value": row.value if row else None, "version": current})
                continue
            if row is None:
                row = KidData.objects.create(user=user, key=key, value=value, version=1)
            else:
                row.value = value
                row.version = current + 1
                row.save(update_fields=["value", "version", "updated_at"])
            applied.append({"key": key, "version": row.version})
        return applied, conflicts


class _QuotaExceeded(Exception):
    pass
