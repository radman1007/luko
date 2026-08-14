from django.utils import timezone
from rest_framework import serializers

from apps.accounts.utils import normalize_phone
from apps.games.models import GameCompletion

from .models import ParentChild


class ChildSerializer(serializers.ModelSerializer):
    """یک ردیفِ فرزند برای کارت‌های بالای پنل."""

    id = serializers.CharField(source="child.id", read_only=True)
    first_name = serializers.CharField(source="child.first_name", read_only=True)
    last_name = serializers.CharField(source="child.last_name", read_only=True)
    phone = serializers.CharField(source="child.phone", read_only=True)
    last_active_at = serializers.SerializerMethodField()
    online = serializers.SerializerMethodField()

    class Meta:
        model = ParentChild
        fields = ["id", "first_name", "last_name", "phone", "grade", "school",
                  "last_active_at", "online"]

    def _last_seen(self, obj):
        last = (
            GameCompletion.objects.filter(user=obj.child)
            .order_by("-created_at").values_list("created_at", flat=True).first()
        )
        return last or obj.child.last_login

    def get_last_active_at(self, obj) -> str:
        last = self._last_seen(obj)
        if not last:
            return "هنوز فعالیتی ثبت نشده"
        return timezone.localtime(last).strftime("%Y/%m/%d %H:%M")

    def get_online(self, obj) -> bool:
        last = self._last_seen(obj)
        return bool(last and (timezone.now() - last).total_seconds() < 300)


class AddChildSerializer(serializers.Serializer):
    phone = serializers.CharField()
    first_name = serializers.CharField(required=False, allow_blank=True, default="")
    last_name = serializers.CharField(required=False, allow_blank=True, default="")
    grade = serializers.IntegerField(required=False, min_value=1, max_value=6, default=1)
    school = serializers.CharField(required=False, allow_blank=True, default="")

    def validate_phone(self, value):
        phone = normalize_phone(value)
        if phone is None:
            raise serializers.ValidationError("شماره‌ی موبایل معتبر نیست.")
        return phone
