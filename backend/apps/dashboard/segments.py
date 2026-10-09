"""
فیلترِ کاربران — هم فهرستِ کاربرانِ داشبورد، هم انتخابِ گیرندگانِ اعلان از همین‌جا.

وضعیتِ اشتراکِ هر دانش‌آموز از آخرین پایانِ دوره‌ی پرداخت‌شده‌اش ساخته می‌شود (همان
که billing.subscription حساب می‌کند): «فعال»، «نیاز به تمدید» (کمتر از یک هفته مانده
یا تا دو هفته پیش تمام شده) و «غیرفعال». والد وضعیتِ فرزندانش را دارد.
"""
from __future__ import annotations

import re
from datetime import datetime, timedelta

from django.db.models import Exists, F, OuterRef, Q, Subquery, Value
from django.db.models.functions import Concat
from django.utils import timezone

from apps.accounts.models import User
from apps.activity.models import ActivitySlot
from apps.activity.services import ONLINE_WINDOW
from apps.billing.models import Payment
from apps.billing.services import EXPIRY_NOTICE_DAYS
from apps.common.constants import GRADE_CHOICES
from apps.common.fa import parse_jalali
from apps.parent.models import ParentChild

#: تا این‌همه روز بعد از پایان هنوز «نیاز به تمدید» است، نه «غیرفعال»
LAPSED_DAYS = 14

ROLE_LABELS = {
    "student": "دانش‌آموز",
    "parent": "والد",
    "staff": "کارمند",
    "admin": "مدیرِ کل",
    "teacher": "معلم",
    "school_admin": "مدیرِ مدرسه",
}

SUB_LABELS = {"active": "فعال", "renewal": "نیاز به تمدید", "inactive": "غیرفعال"}

LAST_SEEN_LABELS = {
    "online": "الان آنلاین", "24h": "۲۴ ساعتِ اخیر", "7d": "۷ روزِ اخیر", "30d": "۳۰ روزِ اخیر",
    "idle7": "بیش از ۷ روز نیامده", "idle30": "بیش از ۳۰ روز نیامده", "never": "هنوز نیامده",
}

_FA_DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")
_FA_LETTERS = str.maketrans({"ي": "ی", "ك": "ک"})


def sub_end_subquery():
    return Subquery(Payment.objects.filter(child=OuterRef("pk"), status=Payment.Status.PAID,
                                           ends_at__isnull=False)
                    .order_by("-ends_at").values("ends_at")[:1])


def sub_status_of(end: datetime | None, now: datetime) -> str:
    if end is None or end <= now - timedelta(days=LAPSED_DAYS):
        return "inactive"
    if end <= now + timedelta(days=EXPIRY_NOTICE_DAYS):
        return "renewal"
    return "active"


def _sub_q(status: str, now: datetime, field: str = "sub_end") -> Q:
    soon, lapsed = now + timedelta(days=EXPIRY_NOTICE_DAYS), now - timedelta(days=LAPSED_DAYS)
    if status == "active":
        return Q(**{f"{field}__gt": soon})
    if status == "renewal":
        return Q(**{f"{field}__gt": lapsed, f"{field}__lte": soon})
    return Q(**{f"{field}__isnull": True}) | Q(**{f"{field}__lte": lapsed})


def _as_list(value) -> list[str]:
    if value is None or value == "":
        return []
    if isinstance(value, (list, tuple)):
        return [str(v) for v in value if str(v).strip()]
    return [v for v in str(value).split(",") if v.strip()]


def _as_bool(value):
    if value in (True, "true", "1", "yes", 1):
        return True
    if value in (False, "false", "0", "no", 0):
        return False
    return None


def _tehran_day_start(day) -> datetime:
    return timezone.make_aware(datetime.combine(day, datetime.min.time()))


def normalized_query(text: str) -> str:
    return re.sub(r"\s+", " ", str(text or "").translate(_FA_DIGITS).translate(_FA_LETTERS)).strip()[:80]


def filter_users(params: dict, *, now: datetime | None = None):
    """
    params (همه اختیاری):
      role: student|parent|staff|admin|teacher|school_admin (چندتایی با ویرگول)
      q: نام یا شماره · grade: «1,2» · sub: active|renewal|inactive (چندتایی)
      seen: online|24h|7d|30d|idle7|idle30|never · platform: web|android (در ۳۰ روزِ اخیر)
      joined_from / joined_to: تاریخِ شمسی · verified / has_children / active: true|false · ids: «12,15»
    """
    now = now or timezone.now()
    qs = User.objects.annotate(sub_end=sub_end_subquery())

    roles = set(_as_list(params.get("role")))
    if roles:
        role_q = Q()
        for role in roles:
            if role == "admin":
                role_q |= Q(is_superuser=True)
            elif role == "staff":
                role_q |= Q(is_staff=True, is_superuser=False)
            elif role in {"student", "parent", "teacher", "school_admin"}:
                role_q |= Q(role=role, is_staff=False)
        qs = qs.filter(role_q)

    q = normalized_query(params.get("q", ""))
    if q:
        digits = re.sub(r"\D", "", q)
        text_q = Q(full_name__icontains=q) | Q(first_name__icontains=q) | Q(last_name__icontains=q)
        if len(digits) >= 3:
            needle = "0" + digits[2:] if digits.startswith("98") and len(digits) >= 12 else digits
            text_q |= Q(phone__contains=needle)
        if digits and digits == q.replace(" ", "") and len(digits) <= 7:
            text_q |= Q(pk=int(digits))
        qs = qs.annotate(full_name=Concat("first_name", Value(" "), "last_name")).filter(text_q)

    grades = [int(g) for g in _as_list(params.get("grade")) if g.isdigit()]
    if grades:
        kids_in_grade = ParentChild.objects.filter(parent=OuterRef("pk"), is_active=True, child__grade__in=grades)
        qs = qs.filter(Q(role=User.Role.STUDENT, grade__in=grades) | Q(role=User.Role.PARENT) & Exists(kids_in_grade))

    subs = [s for s in _as_list(params.get("sub")) if s in SUB_LABELS]
    if subs:
        sub_q = Q()
        child_q = Q()
        for status in subs:
            sub_q |= _sub_q(status, now)
            child_q |= _sub_q(status, now, "child_sub_end")
        children = ParentChild.objects.filter(parent=OuterRef("pk"), is_active=True) \
            .annotate(child_sub_end=Subquery(Payment.objects.filter(
                child=OuterRef("child_id"), status=Payment.Status.PAID, ends_at__isnull=False)
                .order_by("-ends_at").values("ends_at")[:1])) \
            .filter(child_q)
        qs = qs.filter(Q(role=User.Role.STUDENT) & sub_q | Q(role=User.Role.PARENT) & Exists(children))

    seen = params.get("seen")
    if seen == "online":
        qs = qs.filter(last_seen_at__gte=now - ONLINE_WINDOW)
    elif seen in ("24h", "7d", "30d"):
        delta = {"24h": timedelta(hours=24), "7d": timedelta(days=7), "30d": timedelta(days=30)}[seen]
        qs = qs.filter(last_seen_at__gte=now - delta)
    elif seen in ("idle7", "idle30"):
        delta = timedelta(days=7 if seen == "idle7" else 30)
        qs = qs.filter(Q(last_seen_at__lt=now - delta) | Q(last_seen_at__isnull=True))
    elif seen == "never":
        qs = qs.filter(last_seen_at__isnull=True)

    platform = params.get("platform")
    if platform in ActivitySlot.Platform.values:
        used = ActivitySlot.objects.filter(user=OuterRef("pk"), platform=platform,
                                           hour__gte=now - timedelta(days=30))
        qs = qs.filter(Exists(used))

    start = parse_jalali(params.get("joined_from") or "")
    if start:
        qs = qs.filter(date_joined__gte=_tehran_day_start(start))
    end = parse_jalali(params.get("joined_to") or "")
    if end:
        qs = qs.filter(date_joined__lt=_tehran_day_start(end + timedelta(days=1)))

    verified = _as_bool(params.get("verified"))
    if verified is not None:
        qs = qs.filter(phone_verified=verified)

    has_children = _as_bool(params.get("has_children"))
    if has_children is not None:
        linked = ParentChild.objects.filter(parent=OuterRef("pk"), is_active=True)
        qs = qs.filter(Exists(linked)) if has_children else qs.filter(role=User.Role.PARENT).exclude(Exists(linked))

    active = _as_bool(params.get("active"))
    if active is not None:
        qs = qs.filter(is_active=active)

    ids = [int(i) for i in _as_list(params.get("ids")) if str(i).isdigit()][:500]
    if ids:
        qs = qs.filter(pk__in=ids)

    order = params.get("order") or "-joined"
    ordering = {
        "-joined": ["-date_joined"], "joined": ["date_joined"],
        "-seen": [F("last_seen_at").desc(nulls_last=True), "-date_joined"],
        "seen": [F("last_seen_at").asc(nulls_first=True), "-date_joined"],
        "name": ["first_name", "last_name", "pk"],
    }.get(order, ["-date_joined"])
    return qs.order_by(*ordering)


def describe(params: dict) -> str:
    """شرحِ فارسیِ فیلترها — برای تاریخچه‌ی اعلان‌ها."""
    parts = []
    grades = dict(GRADE_CHOICES)
    if params.get("q"):
        parts.append(f"جستجو: {params['q']}")
    if _as_list(params.get("grade")):
        parts.append("پایه: " + "، ".join(str(grades.get(int(g), g)) for g in _as_list(params.get("grade"))
                                           if str(g).isdigit()))
    if _as_list(params.get("sub")):
        parts.append("اشتراک: " + "، ".join(SUB_LABELS.get(s, s) for s in _as_list(params.get("sub"))))
    if params.get("seen") in LAST_SEEN_LABELS:
        parts.append("بازدید: " + LAST_SEEN_LABELS[params["seen"]])
    if params.get("platform") in ("web", "android"):
        parts.append("سکو: " + ("اندروید" if params["platform"] == "android" else "وب"))
    if params.get("joined_from") or params.get("joined_to"):
        parts.append(f"عضویت: {params.get('joined_from') or '…'} تا {params.get('joined_to') or '…'}")
    if _as_bool(params.get("verified")) is not None:
        parts.append("شماره تأییدشده" if _as_bool(params.get("verified")) else "شماره تأییدنشده")
    if _as_bool(params.get("has_children")) is not None:
        parts.append("با فرزند" if _as_bool(params.get("has_children")) else "بی‌فرزند")
    if _as_list(params.get("ids")):
        parts.append(f"{len(_as_list(params.get('ids')))} کاربرِ انتخابی")
    return " · ".join(parts) or "همه"
