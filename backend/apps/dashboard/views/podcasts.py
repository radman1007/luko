"""پادکست‌ها — همان قاعده‌های پنلِ جنگو (فرمِ PodcastAdminForm)، با رابطِ داشبورد."""
from django.db.models import Count, Q
from django.forms.models import model_to_dict
from rest_framework.response import Response

from apps.content.admin import PodcastAdminForm
from apps.content.models import Podcast

from .. import audit
from ..payloads import fa_stamp
from ..security import DashboardView, error, paginate
from ..segments import normalized_query

FIELDS = ("title", "category", "icon", "duration_minutes", "audio_url", "is_active", "sort")


def podcast_row(p: Podcast) -> dict:
    return {
        "id": p.id,
        "title": p.title,
        "category": p.category,
        "icon": p.icon,
        "duration_minutes": p.duration_minutes,
        "audio_src": p.audio_file.url if p.audio_file else p.audio_url,
        "audio_url": p.audio_url,
        "file_name": p.audio_file.name.rsplit("/", 1)[-1] if p.audio_file else "",
        "has_audio": p.has_audio,
        "is_active": p.is_active,
        "sort": p.sort,
        "listens": getattr(p, "n_listens", None),
        "created_fa": fa_stamp(p.created_at),
    }


def form_errors(form) -> str:
    messages = []
    for field, errors in form.errors.items():
        label = form.fields[field].label if field in form.fields else ""
        messages.append(f"{label}: {' '.join(errors)}" if label else " ".join(errors))
    return " · ".join(messages) or "اطلاعاتِ فرم درست نیست."


def _form(request, instance=None):
    data = {k: v for k, v in model_to_dict(instance, fields=FIELDS).items()} if instance else {}
    for key in FIELDS:
        if key in request.data:
            data[key] = request.data.get(key)
    if "audio_file_clear" in request.data and str(request.data.get("audio_file_clear")) in ("true", "1"):
        data["audio_file-clear"] = "on"
    if isinstance(data.get("is_active"), bool) and not data["is_active"]:
        data.pop("is_active")                      # چک‌باکسِ خاموش یعنی نبودنِ کلید
    return PodcastAdminForm(data=data, files=request.FILES, instance=instance)


class PodcastListView(DashboardView):
    """GET ?q=&category=&active=&audio= · POST (multipart)"""

    capability = "podcasts"

    def get(self, request):
        p = request.query_params
        qs = Podcast.objects.annotate(n_listens=Count("listens"))
        q = normalized_query(p.get("q", ""))
        if q:
            qs = qs.filter(Q(title__icontains=q) | Q(category__icontains=q))
        if p.get("category"):
            qs = qs.filter(category=p["category"])
        if p.get("active") in ("true", "false"):
            qs = qs.filter(is_active=p["active"] == "true")
        if p.get("audio") == "missing":
            qs = qs.filter(audio_file="", audio_url="")
        elif p.get("audio") == "ok":
            qs = qs.exclude(audio_file="", audio_url="")
        page, meta = paginate(request, qs.order_by("sort", "-created_at"))
        return Response({"results": [podcast_row(x) for x in page], **meta})

    def post(self, request):
        form = _form(request)
        if not form.is_valid():
            return error(form_errors(form))
        podcast = form.save()
        audit.record(request, "podcast_create", target=podcast, target_type="podcast")
        return Response(podcast_row(podcast), status=201)


class PodcastDetailView(DashboardView):
    capability = "podcasts"

    def patch(self, request, pk):
        podcast = Podcast.objects.filter(pk=pk).first()
        if podcast is None:
            return error("پادکست پیدا نشد.", 404)
        form = _form(request, podcast)
        if not form.is_valid():
            return error(form_errors(form))
        podcast = form.save()
        audit.record(request, "podcast_update", target=podcast, target_type="podcast",
                     details={"fields": sorted(form.changed_data)})
        return Response(podcast_row(podcast))

    def delete(self, request, pk):
        podcast = Podcast.objects.filter(pk=pk).first()
        if podcast is None:
            return error("پادکست پیدا نشد.", 404)
        title = podcast.title
        if podcast.audio_file:
            podcast.audio_file.delete(save=False)
        podcast.delete()
        audit.record(request, "podcast_delete", target_type="podcast", target_label=title,
                     details={"id": pk})
        return Response({"ok": True})
