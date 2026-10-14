"""آموزشِ والدین: مقاله، ویدیو و پادکستِ صفحه‌ی «آموزش» پنلِ والدین (apps/learn)."""
from django import forms
from django.db.models import Count, Q
from django.forms.models import model_to_dict
from rest_framework.response import Response

from apps.blog.markdown import render
from apps.blog.models import BlogImage
from apps.blog.validators import validate_image
from apps.learn.models import LearnItem
from apps.learn.services import media, minutes

from .. import audit
from ..payloads import fa_stamp
from ..security import DashboardView, error, paginate
from ..segments import normalized_query
from .podcasts import form_errors

FIELDS = ("kind", "title", "summary", "topic", "body", "media_url", "duration_minutes", "author", "premium",
          "featured", "status", "sort")
BOOLEANS = ("premium", "featured")


class LearnItemForm(forms.ModelForm):
    class Meta:
        model = LearnItem
        fields = (*FIELDS, "cover", "media_file")

    def clean_title(self):
        title = (self.cleaned_data.get("title") or "").strip()
        if not title:
            raise forms.ValidationError("عنوان لازم است.")
        return title


def row(item: LearnItem) -> dict:
    return {
        "id": item.id,
        "kind": item.kind,
        "kind_label": item.get_kind_display(),
        "title": item.title,
        "summary": item.summary,
        "topic": item.topic,
        "topic_label": item.get_topic_display(),
        "status": item.status,
        "is_live": item.is_live,
        "premium": item.premium,
        "featured": item.featured,
        "minutes": minutes(item),
        "views": item.views,
        "saved": getattr(item, "n_saved", None),
        "has_media": bool(item.media_file or item.media_url),
        "cover_url": item.cover.url if item.cover else "",
        "updated_fa": fa_stamp(item.updated_at),
    }


def detail(item: LearnItem) -> dict:
    return {
        **row(item),
        "body": item.body,
        "body_html": render(item.body),
        "media_url": item.media_url,
        "media_file_name": item.media_file.name.rsplit("/", 1)[-1] if item.media_file else "",
        "media": media(item),
        "duration_minutes": item.duration_minutes,
        "author": item.author,
        "sort": item.sort,
    }


def _form(request, instance=None):
    data = model_to_dict(instance, fields=FIELDS) if instance else {
        "kind": LearnItem.Kind.ARTICLE, "topic": "learning", "status": LearnItem.Status.DRAFT,
        "author": "تیم آموزشی لوکو", "duration_minutes": 0, "sort": 0}
    for key in FIELDS:
        if key in request.data:
            data[key] = request.data.get(key)
    for key in ("duration_minutes", "sort"):
        if data.get(key) in ("", None):
            data[key] = 0
    for key in BOOLEANS:
        # چک‌باکسِ خاموش یعنی نبودنِ کلید (رفتارِ فرمِ جنگو)
        if str(data.get(key)).lower() in ("false", "0", "", "none"):
            data.pop(key, None)
    for key in ("cover", "media_file"):
        if str(request.data.get(f"{key}_clear", "")) in ("true", "1"):
            data[f"{key}-clear"] = "on"
    return LearnItemForm(data=data, files=request.FILES, instance=instance)


class LearnListView(DashboardView):
    """GET ?q=&kind=&topic=&status= · POST (multipart)"""

    capability = "learn"

    def get(self, request):
        p = request.query_params
        qs = LearnItem.objects.annotate(n_saved=Count("progress", filter=Q(progress__saved=True)))
        q = normalized_query(p.get("q", ""))
        if q:
            qs = qs.filter(Q(title__icontains=q) | Q(summary__icontains=q) | Q(body__icontains=q))
        for key in ("kind", "topic", "status"):
            if p.get(key):
                qs = qs.filter(**{key: p[key]})
        page, meta = paginate(request, qs.order_by("sort", "-updated_at"))
        return Response({"results": [row(x) for x in page], **meta})

    def post(self, request):
        form = _form(request)
        if not form.is_valid():
            return error(form_errors(form))
        item = form.save()
        audit.record(request, "learn_create", target=item, target_type="learn", details={"kind": item.kind})
        return Response(detail(item), status=201)


class LearnDetailView(DashboardView):
    capability = "learn"

    def get(self, request, pk):
        item = LearnItem.objects.filter(pk=pk).first()
        return Response(detail(item)) if item else error("محتوا پیدا نشد.", 404)

    def patch(self, request, pk):
        item = LearnItem.objects.filter(pk=pk).first()
        if item is None:
            return error("محتوا پیدا نشد.", 404)
        form = _form(request, item)
        if not form.is_valid():
            return error(form_errors(form))
        item = form.save()
        audit.record(request, "learn_update", target=item, target_type="learn",
                     details={"fields": sorted(form.changed_data)})
        return Response(detail(item))

    def delete(self, request, pk):
        item = LearnItem.objects.filter(pk=pk).first()
        if item is None:
            return error("محتوا پیدا نشد.", 404)
        title = item.title
        for field in (item.cover, item.media_file):
            if field:
                field.delete(save=False)
        item.delete()
        audit.record(request, "learn_delete", target_type="learn", target_label=title, details={"id": pk})
        return Response({"ok": True})


class LearnImageView(DashboardView):
    """POST (multipart: file) — عکسِ داخلِ متن (همان جای عکس‌های وبلاگ)"""

    capability = "learn"

    def post(self, request):
        upload = request.FILES.get("file")
        if not upload:
            return error("عکسی انتخاب نشده است.")
        try:
            validate_image(upload)
        except forms.ValidationError as exc:
            return error(" ".join(exc.messages))
        image = BlogImage.objects.create(file=upload, uploaded_by=request.user)
        audit.record(request, "learn_image", target_type="learn_image", target_label=image.file.name)
        return Response({"url": image.file.url}, status=201)


class LearnPreviewView(DashboardView):
    capability = "learn"

    def post(self, request):
        return Response({"html": render(str(request.data.get("body") or "")[:100_000])})
