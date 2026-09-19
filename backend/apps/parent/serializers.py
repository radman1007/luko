from django.utils import timezone
from rest_framework import serializers

from apps.accounts.passwords import MIN_PASSWORD
from apps.accounts.utils import normalize_phone
from apps.common.fa import fa_when
from apps.games.models import GameCompletion

from .models import DailyAssignment, Notification, ParentChild, ParentPreference


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
        """
        آخرین نشانه‌ی حضور. اگر ویو کوئری را annotate کرده باشد (`last_play`)
        هیچ کوئریِ اضافه‌ای نمی‌خورد؛ وگرنه یک‌بار — و نه دوبار — می‌پرسد.
        """
        if not hasattr(self, "_seen_cache"):
            self._seen_cache = {}
        if obj.pk in self._seen_cache:
            return self._seen_cache[obj.pk]

        last = getattr(obj, "last_play", "__missing__")
        if last == "__missing__":
            last = (
                GameCompletion.objects.filter(user=obj.child)
                .order_by("-created_at").values_list("created_at", flat=True).first()
            )
        value = last or obj.child.last_login
        self._seen_cache[obj.pk] = value
        return value

    def get_last_active_at(self, obj) -> str:
        last = self._last_seen(obj)
        if not last:
            return "هنوز فعالیتی ثبت نشده"
        return fa_when(timezone.localtime(last), timezone.localdate())

    def get_online(self, obj) -> bool:
        last = self._last_seen(obj)
        return bool(last and (timezone.now() - last).total_seconds() < 300)


class AddChildSerializer(serializers.Serializer):
    """
    افزودنِ فرزند از پنلِ والدین.

    رمز اجباری است چون همین رمز است که بچه‌های هم‌شماره را از هم جدا
    می‌کند؛ بدونِ آن حسابِ بچه راهی برای ورود ندارد.
    """

    phone = serializers.CharField()
    password = serializers.CharField(min_length=MIN_PASSWORD, max_length=128,
                                     trim_whitespace=False)
    first_name = serializers.CharField(required=False, allow_blank=True, default="")
    last_name = serializers.CharField(required=False, allow_blank=True, default="")
    grade = serializers.IntegerField(required=False, min_value=1, max_value=6, default=1)
    school = serializers.CharField(required=False, allow_blank=True, default="")

    def validate_phone(self, value):
        phone = normalize_phone(value)
        if phone is None:
            raise serializers.ValidationError("شماره‌ی موبایل معتبر نیست.")
        return phone


class ChildPasswordSerializer(serializers.Serializer):
    password = serializers.CharField(min_length=MIN_PASSWORD, max_length=128,
                                     trim_whitespace=False)


class ChildPhoneSerializer(serializers.Serializer):
    """گامِ دومِ تغییرِ شماره: شماره‌ی تازه به‌همراهِ کدِ هر دو طرف."""

    phone = serializers.CharField()
    current_code = serializers.CharField(max_length=12)
    new_code = serializers.CharField(max_length=12)

    def validate_phone(self, value):
        phone = normalize_phone(value)
        if phone is None:
            raise serializers.ValidationError("شماره‌ی موبایل معتبر نیست.")
        return phone


class AssignmentSerializer(serializers.ModelSerializer):
    game_title = serializers.SerializerMethodField()
    book_title = serializers.SerializerMethodField()
    played = serializers.SerializerMethodField()

    class Meta:
        model = DailyAssignment
        fields = ["id", "game_slug", "game_title", "book_title", "date", "note", "played"]

    def get_game_title(self, obj) -> str:
        game = (self.context.get("games") or {}).get(obj.game_slug)
        return game.title if game else obj.game_slug

    def get_book_title(self, obj) -> str:
        game = (self.context.get("games") or {}).get(obj.game_slug)
        book = (self.context.get("books") or {}).get(game.book_id) if game else None
        return book.title if book else "—"

    def get_played(self, obj) -> bool:
        """آیا بچه همان روز این بازی را تمام کرد؟"""
        return (obj.game_slug, obj.date) in (self.context.get("played") or set())


class CreateAssignmentSerializer(serializers.Serializer):
    game_slug = serializers.SlugField()
    date = serializers.DateField()
    note = serializers.CharField(max_length=160, required=False, allow_blank=True, default="")

    def validate_game_slug(self, value):
        from apps.games.models import Game
        game = Game.objects.playable().filter(slug=value).first()
        if game is None:
            raise serializers.ValidationError("این بازی وجود ندارد یا فعال نیست.")
        child = self.context.get("child")
        # بچه فقط مسیرِ کلاسِ خودش را می‌بیند؛ بازیِ کلاسِ دیگر برایش باز نمی‌شد
        if child is not None and game.grade != child.grade:
            raise serializers.ValidationError("این بازی برای کلاسِ این فرزند نیست.")
        return value

    def validate_date(self, value):
        from django.utils import timezone
        if value < timezone.localdate():
            raise serializers.ValidationError("برای روزهای گذشته نمی‌شود بازی گذاشت.")
        return value


class PreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = ParentPreference
        fields = ["weekly_report", "activity_alerts"]


class NotificationSerializer(serializers.ModelSerializer):
    child_name = serializers.SerializerMethodField()
    at = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = ["id", "kind", "title", "body", "is_read", "child_name", "at"]

    def get_child_name(self, obj) -> str:
        if obj.child is None:
            return ""
        return (obj.child.first_name or obj.child.phone).strip()

    def get_at(self, obj) -> str:
        return fa_when(timezone.localtime(obj.created_at), timezone.localdate())
