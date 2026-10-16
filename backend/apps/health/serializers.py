from rest_framework import serializers

from django.utils import timezone

from apps.common.fa import fa_when

from .models import BreathingSession, MoodCheckin, Painting, Secret


class MoodCheckinSerializer(serializers.ModelSerializer):
    # زمانِ ثبت روی دستگاه (Date.now())؛ همان که در luko_last_mood_time هم‌رسان می‌شود
    at = serializers.IntegerField(required=False, write_only=True, min_value=0)

    class Meta:
        model = MoodCheckin
        fields = ["id", "mood", "at", "created_at"]
        read_only_fields = ["id", "created_at"]


# سقفِ حجمِ data URL. بومِ یک گوشی حتی با کیفیتِ خوب خیلی کمتر از این است؛
# این فقط جلوی پُرکردنِ عمدیِ دیتابیس را می‌گیرد.
MAX_IMAGE_CHARS = 900_000
MAX_THUMB_CHARS = 60_000

DATA_URL_PREFIXES = ("data:image/jpeg;base64,", "data:image/png;base64,", "data:image/webp;base64,")


def _validate_data_url(value: str, limit: int, label: str) -> str:
    """فقط data URLِ تصویری، و نه بزرگ‌تر از سقف."""
    if not value:
        return value
    if not value.startswith(DATA_URL_PREFIXES):
        raise serializers.ValidationError(f"{label} باید تصویر باشد.")
    if len(value) > limit:
        raise serializers.ValidationError(f"{label} بیش از حد بزرگ است.")
    return value


class PaintingSerializer(serializers.ModelSerializer):
    """فهرستِ گالری — عمداً بدونِ `image` تا پاسخ سبک بماند."""

    when = serializers.SerializerMethodField()

    class Meta:
        model = Painting
        fields = ["id", "title", "mood", "colors", "thumbnail", "when", "created_at"]
        read_only_fields = ["id", "created_at"]

    def get_when(self, obj) -> str:
        return fa_when(timezone.localtime(obj.created_at), timezone.localdate())

    def validate_thumbnail(self, value):
        return _validate_data_url(value, MAX_THUMB_CHARS, "بندانگشتی")


class PaintingCreateSerializer(PaintingSerializer):
    """هنگامِ ذخیره تصویرِ کامل هم می‌آید."""

    class Meta(PaintingSerializer.Meta):
        fields = [*PaintingSerializer.Meta.fields, "image"]

    def validate_image(self, value):
        return _validate_data_url(value, MAX_IMAGE_CHARS, "نقاشی")


class PaintingImageSerializer(serializers.ModelSerializer):
    """فقط خودِ تصویر — وقتی بچه یک نقاشی را باز می‌کند."""

    class Meta:
        model = Painting
        fields = ["id", "image"]


class SecretSerializer(serializers.ModelSerializer):
    class Meta:
        model = Secret
        fields = ["id", "title", "payload", "created_at"]
        read_only_fields = ["id", "created_at"]


class BreathingSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = BreathingSession
        fields = ["id", "cycles", "seconds", "created_at"]
        read_only_fields = ["id", "created_at"]
