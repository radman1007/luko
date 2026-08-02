from rest_framework import serializers

from .models import Game, GameEvent


class GameSerializer(serializers.ModelSerializer):
    class Meta:
        model = Game
        fields = ["slug", "title", "book_id", "order", "coin_reward",
                  "dew_reward", "fertilizer_reward", "is_active"]


class GameEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = GameEvent
        fields = ["game_slug", "event_type", "payload"]
