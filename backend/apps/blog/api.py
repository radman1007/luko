"""شکلِ خروجیِ پست — هم برای API عمومی، هم داشبورد."""
from __future__ import annotations

from django.conf import settings
from django.utils import timezone

from apps.common.fa import fa_date

from .markdown import render
from .models import BlogPost


def media_base() -> str:
    return settings.SITE_URL.rstrip("/")


def absolute(file_field) -> str:
    return f"{media_base()}{file_field.url}" if file_field else ""


def post_summary(post: BlogPost) -> dict:
    published = timezone.localtime(post.published_at) if post.published_at else None
    return {
        "id": post.id,
        "title": post.title,
        "slug": post.slug,
        "summary": post.summary,
        "cover_url": absolute(post.cover),
        "category": post.category,
        "tags": post.tag_list,
        "status": post.status,
        "published_at": published.isoformat() if published else None,
        "published_fa": fa_date(published.date(), with_year=True) if published else "",
        "reading_minutes": post.reading_minutes,
        "author": (f"{post.author.first_name} {post.author.last_name}".strip() if post.author else ""),
    }


def post_detail(post: BlogPost) -> dict:
    return {
        **post_summary(post),
        "body": post.body,
        "body_html": render(post.body, media_base=media_base()),
        "seo_title": post.seo_title or post.title,
        "seo_description": post.seo_description or post.summary,
    }
