"""فرستادنِ اعلانِ همگانی: یک ردیف برای هر گیرنده، در یک تراکنش."""
from __future__ import annotations

from django.db import transaction

from apps.accounts.models import User
from apps.parent.models import Notification

from .models import Broadcast, KidNotice

BATCH = 500


@transaction.atomic
def send_broadcast(*, audience: str, recipients, title: str, body: str = "", link: str = "",
                   filters: dict | None = None, filters_label: str = "", sent_by: User | None = None) -> Broadcast:
    """
    `recipients` کوئری‌ستِ کاربران است (همان که پیش‌نمایش شمرد). نقشِ هر کس دوباره
    چک می‌شود: اعلانِ والد هرگز به حسابِ بچه نمی‌رود و برعکس.
    """
    role = User.Role.PARENT if audience == Broadcast.Audience.PARENTS else User.Role.STUDENT
    ids = list(recipients.filter(role=role, is_active=True).order_by().values_list("pk", flat=True).distinct())
    broadcast = Broadcast.objects.create(
        audience=audience, title=title, body=body, link=link, filters=filters or {},
        filters_label=filters_label[:300], recipients=len(ids), sent_by=sent_by,
    )
    for start in range(0, len(ids), BATCH):
        chunk = ids[start:start + BATCH]
        if role == User.Role.PARENT:
            Notification.objects.bulk_create([
                Notification(user_id=pk, kind=Notification.Kind.ANNOUNCEMENT, title=title, body=body,
                             link=link, dedup_key=f"broadcast:{broadcast.pk}")
                for pk in chunk
            ], ignore_conflicts=True)
        else:
            KidNotice.objects.bulk_create([
                KidNotice(user_id=pk, broadcast=broadcast, title=title, body=body, link=link)
                for pk in chunk
            ], ignore_conflicts=True)
    return broadcast


def reach(broadcast: Broadcast) -> dict:
    """چند نفر دیده‌اند — برای تاریخچه‌ی داشبورد."""
    if broadcast.audience == Broadcast.Audience.PARENTS:
        qs = Notification.objects.filter(dedup_key=f"broadcast:{broadcast.pk}")
    else:
        qs = KidNotice.objects.filter(broadcast=broadcast)
    total = qs.count()
    return {"delivered": total, "read": qs.filter(is_read=True).count()}
