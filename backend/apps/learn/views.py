"""
API صفحه‌ی «آموزش» پنلِ والدین.

GET  /parent/learn?child=<id>      فهرست، برگزیده، شمارِ هر نوع و موضوع، و پیشنهاد برای همان فرزند
GET  /parent/learn/<id>            یک محتوا (قفل: فقط چند بندِ اول، بی‌پخش‌کننده) + محتوای هم‌موضوع
POST /parent/learn/<id>/progress   {saved?, done?, seconds?}
"""
from django.db.models import F
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.parent.models import ParentChild
from apps.parent.permissions import IsParent

from .models import LearnItem, LearnProgress, Topic
from .services import detail, free_ids, live_items, newest_ids, parent_premium, picks_for, summary

RELATED = 3


def _not_found():
    return Response({"error": {"code": 404, "message": "این محتوا پیدا نشد."}}, status=404)


class LearnListView(APIView):
    permission_classes = [IsParent]

    def get(self, request):
        premium = parent_premium(request.user)
        items = list(live_items())
        progress = {p.item_id: p for p in LearnProgress.objects.filter(parent=request.user)}
        new_ids = newest_ids(items)
        free = free_ids(items)
        rows = [summary(i, premium=premium, free=free, progress=progress.get(i.id), new_ids=new_ids) for i in items]
        by_id = {row["id"]: row for row in rows}
        featured = next((row for row in rows if row["featured"]), rows[0] if rows else None)

        for_child = None
        child_id = request.query_params.get("child")
        link = ParentChild.objects.filter(parent=request.user, child_id=child_id, is_active=True) \
            .select_related("child").first() if child_id and child_id.isdigit() else None
        if link and items:
            done = {pk for pk, p in progress.items() if p.done}
            picks = picks_for(link.child, items, done)
            if picks:
                for_child = {
                    "child_name": (link.child.first_name or "").strip() or "فرزندتان",
                    "picks": [{"item": by_id[item.id], "reason": why} for item, why in picks],
                }

        counts = {kind: sum(1 for r in rows if r["kind"] == kind) for kind in LearnItem.Kind.values}
        topics = [{"key": key, "label": label, "count": sum(1 for r in rows if r["topic"] == key)}
                  for key, label in Topic.choices]
        return Response({
            "premium": premium,
            "featured": featured,
            "items": rows,
            "counts": counts,
            "topics": [t for t in topics if t["count"]],
            "locked": sum(1 for r in rows if r["locked"]),
            "for_child": for_child,
        })


class LearnDetailView(APIView):
    permission_classes = [IsParent]

    def get(self, request, pk):
        item = live_items().filter(pk=pk).first()
        if item is None:
            return _not_found()
        premium = parent_premium(request.user)
        progress, created = LearnProgress.objects.get_or_create(parent=request.user, item=item)
        if created:
            LearnItem.objects.filter(pk=item.pk).update(views=F("views") + 1)
        others = list(live_items().filter(topic=item.topic).exclude(pk=item.pk)[:RELATED])
        if len(others) < RELATED:
            others += list(live_items().exclude(pk__in=[item.pk, *[o.pk for o in others]])[:RELATED - len(others)])
        mine = {p.item_id: p for p in LearnProgress.objects.filter(parent=request.user, item__in=others)}
        new_ids = newest_ids(live_items().only("id", "published_at"))
        free = free_ids()
        related = [summary(o, premium=premium, free=free, progress=mine.get(o.id), new_ids=new_ids) for o in others]
        return Response(detail(item, premium=premium, free=free, progress=progress, related=related,
                               new_ids=new_ids))


class LearnProgressView(APIView):
    permission_classes = [IsParent]

    def post(self, request, pk):
        item = live_items().filter(pk=pk).first()
        if item is None:
            return _not_found()
        progress, _ = LearnProgress.objects.get_or_create(parent=request.user, item=item)
        fields = []
        for key in ("saved", "done"):
            if key in request.data:
                setattr(progress, key, bool(request.data.get(key)))
                fields.append(key)
        if "seconds" in request.data:
            try:
                progress.seconds = max(0, min(int(request.data.get("seconds") or 0), 6 * 3600))
            except (TypeError, ValueError):
                return Response({"error": {"code": 400, "message": "مقدارِ نادرست."}}, status=400)
            fields.append("seconds")
        if fields:
            progress.save(update_fields=[*fields, "updated_at"])
        return Response({"saved": progress.saved, "done": progress.done, "seconds": progress.seconds})
