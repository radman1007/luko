"""
API عمومیِ وبلاگ برای سایتِ لندینگ. فقط پست‌های منتشرشده، بی‌احراز هویت، و CORS
فقط برای دامنه‌های BLOG_CORS_ORIGINS (پیش‌فرض luko.ir و www.luko.ir).
"""
import math

from django.conf import settings
from django.db.models import Q
from django.utils import timezone
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .api import post_detail, post_summary
from .models import BlogPost, split_tags

PAGE_SIZE = 12


def _live():
    return BlogPost.objects.filter(status=BlogPost.Status.PUBLISHED, published_at__lte=timezone.now()) \
        .select_related("author")


class PublicBlogView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        origin = request.headers.get("Origin", "")
        if origin and origin in settings.BLOG_CORS_ORIGINS:
            response["Access-Control-Allow-Origin"] = origin
            response["Vary"] = "Origin"
            response["Access-Control-Allow-Methods"] = "GET, OPTIONS"
        if request.method == "GET" and response.status_code == 200:
            response["Cache-Control"] = "public, max-age=60"
        return response


class PostListView(PublicBlogView):
    """GET /blog/posts?page=&q=&tag=&category="""

    def get(self, request):
        qs = _live()
        q = (request.query_params.get("q") or "").strip()[:80]
        if q:
            qs = qs.filter(Q(title__icontains=q) | Q(summary__icontains=q) | Q(body__icontains=q))
        tag = (request.query_params.get("tag") or "").strip()[:40]
        if tag:   # برچسبِ دقیق: «تربیت» نباید «تربیتی» را هم بیاورد
            candidates = qs.filter(tags__icontains=tag).values_list("id", "tags")
            ids = [pk for pk, tags in candidates if tag in split_tags(tags)]
            qs = qs.filter(id__in=ids)
        category = (request.query_params.get("category") or "").strip()[:60]
        if category:
            qs = qs.filter(category=category)
        count = qs.count()
        pages = max(1, math.ceil(count / PAGE_SIZE))
        try:
            page = min(max(1, int(request.query_params.get("page", 1))), pages)
        except (TypeError, ValueError):
            page = 1
        rows = qs[(page - 1) * PAGE_SIZE: page * PAGE_SIZE]
        return Response({"results": [post_summary(p) for p in rows], "count": count, "page": page, "pages": pages})


class PostDetailView(PublicBlogView):
    """GET /blog/posts/<slug>"""

    def get(self, request, slug):
        post = _live().filter(slug=slug).first()
        if post is None:
            return Response({"error": {"code": 404, "message": "پست پیدا نشد."}}, status=404)
        return Response(post_detail(post))
