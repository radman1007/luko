from django.contrib import admin
from django.db.models import Sum

from apps.common.admin_helpers import jalali
from apps.common.fa import fa_digits

from .models import AIInsight, AIUsage, AssistantMessage


@admin.register(AIUsage)
class AIUsageAdmin(admin.ModelAdmin):
    """مصرفِ توکن به تفکیکِ بخش و مدل؛ جمعِ فهرستِ فیلترشده بالای جدول"""

    list_display = ("when", "feature", "tier", "model", "ok", "error", "tokens", "seconds", "user", "child")
    list_filter = ("feature", "tier", "ok", "model")
    date_hierarchy = "created_at"
    raw_id_fields = ("user", "child")
    list_per_page = 100

    when = jalali("created_at", "زمان")

    @admin.display(description="توکن (ورودی/خروجی/استدلال)")
    def tokens(self, obj):
        return fa_digits(f"{obj.prompt_tokens}/{obj.completion_tokens}/{obj.reasoning_tokens}")

    @admin.display(description="ثانیه")
    def seconds(self, obj):
        return fa_digits(round(obj.latency_ms / 1000, 1))

    def changelist_view(self, request, extra_context=None):
        response = super().changelist_view(request, extra_context)
        try:
            qs = response.context_data["cl"].queryset
        except (AttributeError, KeyError):
            return response
        total = qs.aggregate(i=Sum("prompt_tokens"), o=Sum("completion_tokens"), r=Sum("reasoning_tokens"))
        response.context_data["title"] = (
            f"مصرفِ هوش مصنوعی — {fa_digits(qs.count())} درخواست، توکنِ ورودی {fa_digits(total['i'] or 0)}، "
            f"خروجی {fa_digits(total['o'] or 0)} (استدلال {fa_digits(total['r'] or 0)})"
        )
        return response

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(AIInsight)
class AIInsightAdmin(admin.ModelAdmin):
    list_display = ("child", "variant", "tier", "model", "updated", "rejected")
    list_filter = ("variant", "tier")
    raw_id_fields = ("child",)
    readonly_fields = ("child", "variant", "fingerprint", "tier", "model", "payload", "rejected")

    updated = jalali("updated_at", "به‌روزرسانی")

    def has_add_permission(self, request):
        return False


@admin.register(AssistantMessage)
class AssistantMessageAdmin(admin.ModelAdmin):
    list_display = ("parent", "child", "role", "tier", "status", "short", "sent")
    list_filter = ("role", "tier", "status")
    raw_id_fields = ("parent", "child")
    search_fields = ("content", "parent__phone")

    sent = jalali("created_at", "زمان")

    @admin.display(description="متن")
    def short(self, obj):
        return obj.content[:80]

    def has_add_permission(self, request):
        return False
