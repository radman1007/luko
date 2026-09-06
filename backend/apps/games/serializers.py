from rest_framework import serializers

from .models import Book, Game, GameEvent, SeasonMemory


class GameSerializer(serializers.ModelSerializer):
    class Meta:
        model = Game
        fields = ["slug", "title", "book_id", "order", "coin_reward",
                  "dew_reward", "fertilizer_reward", "max_stars", "is_active"]


class GameEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = GameEvent
        fields = ["game_slug", "event_type", "payload"]


class BookSerializer(serializers.ModelSerializer):
    """کتاب + مراحلش (بازی‌های همان کتاب، به ترتیب)."""

    levels = serializers.SerializerMethodField()

    class Meta:
        model = Book
        fields = ["book_id", "title", "subject", "grade", "world_title", "icon", "levels"]

    def get_levels(self, obj) -> list:
        games = (self.context.get("games_by_book") or {}).get(obj.book_id, [])
        return GameSerializer(games, many=True).data


class SeasonMemorySerializer(serializers.ModelSerializer):
    """
    یادگاری. `image` فقط نوشتنی است: فهرست باید سبک بماند و تصویرِ کامل
    از مسیرِ خودش بیاید، وگرنه بازکردنِ نقشه چند مگابایت داده می‌کشد.
    """

    class Meta:
        model = SeasonMemory
        fields = ["id", "season_id", "spot_id", "thumbnail", "image", "created_at"]
        extra_kwargs = {"image": {"write_only": True, "required": False}}
        read_only_fields = ["id", "created_at"]
