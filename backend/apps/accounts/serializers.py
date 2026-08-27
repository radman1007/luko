from rest_framework import serializers

from .models import KidSettings, Lukorian, User
from .utils import normalize_phone


class UserSerializer(serializers.ModelSerializer):
    # فرانت id را رشته می‌خواهد (type User.id: string)
    id = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = ["id", "role", "first_name", "last_name", "phone"]


class PhoneField(serializers.CharField):
    """شماره را نرمال و اعتبارسنجی می‌کند (۰۹xxxxxxxxx)."""

    def to_internal_value(self, data):
        raw = super().to_internal_value(data)
        phone = normalize_phone(raw)
        if phone is None:
            raise serializers.ValidationError("شماره‌ی موبایل معتبر نیست.")
        return phone


class RequestOTPSerializer(serializers.Serializer):
    phone = PhoneField()


class VerifyOTPSerializer(serializers.Serializer):
    phone = PhoneField()
    code = serializers.CharField(min_length=4, max_length=8)
    # فقط هنگام ثبت‌نامِ حسابِ تازه استفاده می‌شوند
    first_name = serializers.CharField(max_length=60, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=60, required=False, allow_blank=True)
    # نقشِ حسابِ تازه. عمداً محدود است: نقش‌های کارکنان (معلم/مدرسه/ادمین) هرگز
    # از سمتِ کاربر ساخته نمی‌شوند و نقشِ حسابِ موجود هم با این تغییر نمی‌کند.
    role = serializers.ChoiceField(
        choices=[("student", "student"), ("parent", "parent")],
        required=False, default="student",
    )


class KidSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = KidSettings
        fields = ["sound", "music", "mood_reminder", "extra"]


class LukorianSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lukorian
        fields = ["unlocked", "is_built", "owned_items", "config", "custom_status"]
        read_only_fields = ["unlocked", "custom_status"]
