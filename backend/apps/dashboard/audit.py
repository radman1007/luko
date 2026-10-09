"""ثبتِ گزارشِ فعالیت. هیچ‌وقت نباید کارِ اصلی را خراب کند."""
from __future__ import annotations

import logging

from apps.common.admin_site import client_ip

from .models import AuditLog

log = logging.getLogger("luko.dashboard")

#: برچسبِ فارسیِ هر کار برای صفحه‌ی گزارش
ACTIONS = {
    "login": "ورود به داشبورد",
    "login_failed": "ورودِ ناموفق",
    "logout": "خروج",
    "user_edit": "ویرایشِ کاربر",
    "user_logout_all": "خروجِ کاربر از همه‌ی دستگاه‌ها",
    "gift_grant": "هدیه‌ی اشتراک",
    "gift_revoke": "لغوِ هدیه",
    "ticket_reply": "پاسخ به تیکت",
    "ticket_status": "تغییرِ وضعیتِ تیکت",
    "podcast_create": "افزودنِ پادکست",
    "podcast_update": "ویرایشِ پادکست",
    "podcast_delete": "حذفِ پادکست",
    "blog_create": "نوشتنِ پست",
    "blog_update": "ویرایشِ پست",
    "blog_delete": "حذفِ پست",
    "blog_image": "بارگذاریِ عکسِ وبلاگ",
    "notice_send": "ارسالِ اعلان",
    "staff_create": "تعریفِ کارمند",
    "staff_update": "ویرایشِ دسترسیِ کارمند",
    "staff_password": "تغییرِ رمزِ کارمند",
    "staff_remove": "برداشتنِ دسترسیِ کارمند",
}


def label_of(user) -> str:
    if user is None:
        return ""
    name = f"{user.first_name} {user.last_name}".strip()
    return f"{name} ({user.phone})" if name else user.phone


def record(request, action: str, *, actor=None, target=None, target_type: str = "", target_label: str = "",
           details: dict | None = None) -> None:
    try:
        actor = actor if actor is not None else (request.user if request.user.is_authenticated else None)
        AuditLog.objects.create(
            actor=actor, actor_label=label_of(actor)[:120], action=action,
            target_type=target_type or (target.__class__.__name__.lower() if target is not None else ""),
            target_id=str(getattr(target, "pk", "") or "")[:40],
            target_label=(target_label or (str(target) if target is not None else ""))[:200],
            details=details or {}, ip=client_ip(request)[:64],
            user_agent=request.META.get("HTTP_USER_AGENT", "")[:200],
        )
    except Exception:                                             # noqa: BLE001
        log.exception("ثبتِ گزارشِ فعالیت نشد: %s", action)
