from django.contrib import admin

from .models import BlogImage, BlogPost


@admin.register(BlogPost)
class BlogPostAdmin(admin.ModelAdmin):
    list_display = ("title", "status", "category", "published_at", "author")
    list_filter = ("status", "category")
    search_fields = ("title", "summary", "body", "tags")
    readonly_fields = ("slug",)


@admin.register(BlogImage)
class BlogImageAdmin(admin.ModelAdmin):
    list_display = ("file", "uploaded_by", "created_at")
