"""
وبلاگِ لوکو. نوشتن و انتشار از داشبورد؛ نمایش روی سایتِ لندینگ (luko.ir) از راهِ
API عمومیِ /api/v1/blog/. متن مارک‌داونِ ساده است و سرور آن را به HTMLِ امن می‌دهد.
"""
from __future__ import annotations

import math

from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.text import slugify

from apps.common.models import TimeStampedModel

from .markdown import plain_text
from .validators import validate_image


def split_tags(text: str) -> list[str]:
    """«تربیت، بازی,یادگیری» → ["تربیت", "بازی", "یادگیری"]"""
    return [t.strip() for t in (text or "").replace("،", ",").split(",") if t.strip()]


class BlogPost(TimeStampedModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "پیش‌نویس"
        PUBLISHED = "published", "منتشرشده"

    title = models.CharField(max_length=160, verbose_name="عنوان")
    slug = models.SlugField(max_length=180, unique=True, allow_unicode=True, verbose_name="نامک")
    summary = models.CharField(max_length=300, blank=True, verbose_name="خلاصه")
    body = models.TextField(blank=True, verbose_name="متن")
    cover = models.FileField(upload_to="blog/%Y/%m/", blank=True, validators=[validate_image],
                             verbose_name="تصویرِ شاخص")
    category = models.CharField(max_length=60, blank=True, db_index=True, verbose_name="دسته")
    #: «تربیت، بازی، یادگیری» — با ویرگول جدا
    tags = models.CharField(max_length=200, blank=True, verbose_name="برچسب‌ها")
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.DRAFT,
                              db_index=True, verbose_name="وضعیت")
    published_at = models.DateTimeField(null=True, blank=True, db_index=True, verbose_name="زمانِ انتشار")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
                               related_name="blog_posts", verbose_name="نویسنده")
    seo_title = models.CharField(max_length=160, blank=True, verbose_name="عنوانِ سئو")
    seo_description = models.CharField(max_length=300, blank=True, verbose_name="توضیحِ سئو")

    class Meta:
        verbose_name = "پستِ وبلاگ"
        verbose_name_plural = "پست‌های وبلاگ"
        ordering = ["-published_at", "-created_at"]

    def __str__(self):
        return self.title

    @property
    def tag_list(self) -> list[str]:
        return split_tags(self.tags)

    @property
    def reading_minutes(self) -> int:
        return max(1, math.ceil(len(plain_text(self.body).split()) / 200))

    @property
    def is_live(self) -> bool:
        return (self.status == self.Status.PUBLISHED and self.published_at is not None
                and self.published_at <= timezone.now())

    def make_slug(self) -> str:
        base = slugify(self.slug or self.title, allow_unicode=True)[:170] or "post"
        slug, n = base, 2
        while BlogPost.objects.filter(slug=slug).exclude(pk=self.pk).exists():
            slug, n = f"{base}-{n}", n + 1
        return slug

    def save(self, *args, **kwargs):
        self.slug = self.make_slug()
        if self.status == self.Status.PUBLISHED and self.published_at is None:
            self.published_at = timezone.now()
        super().save(*args, **kwargs)


class BlogImage(TimeStampedModel):
    """عکسی که داخلِ متنِ پست گذاشته می‌شود."""

    file = models.FileField(upload_to="blog/images/%Y/%m/", validators=[validate_image], verbose_name="فایل")
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True,
                                    related_name="+", verbose_name="بارگذار")

    class Meta:
        verbose_name = "عکسِ وبلاگ"
        verbose_name_plural = "عکس‌های وبلاگ"

    def __str__(self):
        return self.file.name
