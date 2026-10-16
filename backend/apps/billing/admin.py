from django.contrib import admin, messages

from apps.common.admin_helpers import jalali
from apps.common.fa import fa_digits

from .models import Payment, Plan
from .services import reconcile


@admin.register(Plan)
class PlanAdmin(admin.ModelAdmin):
    list_display = ("title", "code", "price_display", "duration_days", "is_active", "order")
    list_editable = ("is_active", "order")

    @admin.display(description="قیمت (تومان)", ordering="price_toman")
    def price_display(self, obj):
        return fa_digits(f"{obj.price_toman:,}")


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    """صورت‌حساب‌ها فقط خواندنی‌اند؛ وضعیت را فقط درگاه عوض می‌کند (اقدامِ «پیگیری»)."""

    list_display = ("factor_number", "child_name", "payer_phone", "plan_title", "amount_display",
                    "status", "gateway", "trans_id", "created", "ends")
    list_filter = ("status", "gateway", "plan")
    search_fields = ("factor_number", "trans_id", "payer_phone", "child_name", "token")
    actions = ["reconcile_with_gateway"]
    created = jalali("created_at", "ثبت")
    ends = jalali("ends_at", "پایانِ اشتراک", with_time=False)

    def get_readonly_fields(self, request, obj=None):
        return [f.name for f in Payment._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    @admin.display(description="مبلغ (تومان)", ordering="amount_toman")
    def amount_display(self, obj):
        return fa_digits(f"{obj.amount_toman:,}")

    @admin.action(description="پیگیری با درگاه (پرداخت‌های در انتظار)")
    def reconcile_with_gateway(self, request, queryset):
        done = 0
        for payment in queryset.filter(status=Payment.Status.PENDING):
            reconcile(payment.id)
            done += 1
        self.message_user(request, f"{fa_digits(done)} پرداخت پیگیری شد.", messages.INFO)
