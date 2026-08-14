from django.contrib import admin

from .models import ParentChild


@admin.register(ParentChild)
class ParentChildAdmin(admin.ModelAdmin):
    list_display = ("parent", "child", "relation", "grade", "school", "is_active")
    list_filter = ("relation", "grade", "is_active")
    search_fields = ("parent__phone", "child__phone", "child__first_name")
    autocomplete_fields = ()
