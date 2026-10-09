"""وبلاگ: نوشتن، ویرایش، انتشار، عکس و پیش‌نمایش."""
from django import forms
from django.db.models import Q
from django.forms.models import model_to_dict
from rest_framework.response import Response

from apps.blog.api import absolute, post_detail, post_summary
from apps.blog.markdown import render
from apps.blog.models import BlogImage, BlogPost
from apps.blog.validators import validate_image

from .. import audit
from ..payloads import fa_stamp
from ..security import DashboardView, error, paginate
from ..segments import normalized_query
from .podcasts import form_errors

FIELDS = ("title", "slug", "summary", "body", "category", "tags", "status", "seo_title", "seo_description")


class BlogPostForm(forms.ModelForm):
    class Meta:
        model = BlogPost
        fields = (*FIELDS, "cover")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["slug"].required = False          # از عنوان ساخته می‌شود

    def clean_title(self):
        title = (self.cleaned_data.get("title") or "").strip()
        if not title:
            raise forms.ValidationError("عنوان لازم است.")
        return title


def detail(post: BlogPost) -> dict:
    """مثلِ API عمومی، ولی سئو همان که نوشته شده — نه جانشینِ «عنوان/خلاصه» (وگرنه ذخیره‌ی بعدی ثابتش می‌کرد)."""
    return {**post_detail(post), "seo_title": post.seo_title, "seo_description": post.seo_description}


def row(post: BlogPost) -> dict:
    return {**post_summary(post), "updated_fa": fa_stamp(post.updated_at), "is_live": post.is_live}


def _form(request, instance=None):
    data = model_to_dict(instance, fields=FIELDS) if instance else {"status": BlogPost.Status.DRAFT}
    for key in FIELDS:
        if key in request.data:
            data[key] = request.data.get(key)
    if str(request.data.get("cover_clear", "")) in ("true", "1"):
        data["cover-clear"] = "on"
    return BlogPostForm(data=data, files=request.FILES, instance=instance)


class PostListView(DashboardView):
    """GET ?q=&status=&category= · POST (multipart)"""

    capability = "blog"

    def get(self, request):
        p = request.query_params
        qs = BlogPost.objects.select_related("author")
        q = normalized_query(p.get("q", ""))
        if q:
            qs = qs.filter(Q(title__icontains=q) | Q(summary__icontains=q) | Q(body__icontains=q) | Q(tags__icontains=q))
        if p.get("status") in BlogPost.Status.values:
            qs = qs.filter(status=p["status"])
        if p.get("category"):
            qs = qs.filter(category=p["category"])
        page, meta = paginate(request, qs.order_by("-updated_at"))
        categories = sorted(c for c in BlogPost.objects.values_list("category", flat=True).distinct() if c)
        return Response({"results": [row(x) for x in page], **meta, "categories": categories})

    def post(self, request):
        form = _form(request)
        if not form.is_valid():
            return error(form_errors(form))
        post = form.save(commit=False)
        post.author = request.user
        post.save()
        audit.record(request, "blog_create", target=post, target_type="blog", details={"status": post.status})
        return Response(detail(post), status=201)


class PostDetailView(DashboardView):
    capability = "blog"

    def _get(self, pk):
        return BlogPost.objects.select_related("author").filter(pk=pk).first()

    def get(self, request, pk):
        post = self._get(pk)
        return Response(detail(post)) if post else error("پست پیدا نشد.", 404)

    def patch(self, request, pk):
        post = self._get(pk)
        if post is None:
            return error("پست پیدا نشد.", 404)
        was = post.status
        form = _form(request, post)
        if not form.is_valid():
            return error(form_errors(form))
        post = form.save()
        audit.record(request, "blog_update", target=post, target_type="blog",
                     details={"fields": sorted(form.changed_data), "status": [was, post.status]})
        return Response(detail(post))

    def delete(self, request, pk):
        post = self._get(pk)
        if post is None:
            return error("پست پیدا نشد.", 404)
        title = post.title
        if post.cover:
            post.cover.delete(save=False)
        post.delete()
        audit.record(request, "blog_delete", target_type="blog", target_label=title, details={"id": pk})
        return Response({"ok": True})


class BlogImageView(DashboardView):
    """POST (multipart: file) — عکسِ داخلِ متن؛ نشانی‌اش را برای ![...](...) برمی‌گرداند."""

    capability = "blog"

    def post(self, request):
        upload = request.FILES.get("file")
        if not upload:
            return error("عکسی انتخاب نشده است.")
        try:
            validate_image(upload)
        except forms.ValidationError as exc:
            return error(" ".join(exc.messages))
        image = BlogImage.objects.create(file=upload, uploaded_by=request.user)
        audit.record(request, "blog_image", target_type="blog_image", target_label=image.file.name)
        return Response({"url": image.file.url, "absolute_url": absolute(image.file),
                         "markdown": f"![]({image.file.url})"}, status=201)


class BlogPreviewView(DashboardView):
    """POST {body} — همان HTMLی که سایتِ لندینگ نشان می‌دهد."""

    capability = "blog"

    def post(self, request):
        body = str(request.data.get("body") or "")[:100_000]
        return Response({"html": render(body)})
