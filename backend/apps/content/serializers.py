from rest_framework import serializers

from .models import Podcast, Recipe, TrafficRule, Video


class VideoSerializer(serializers.ModelSerializer):
    liked = serializers.SerializerMethodField()

    class Meta:
        model = Video
        fields = ["id", "title", "category", "duration_minutes", "icon",
                  "url", "thumbnail", "views", "liked"]

    def get_liked(self, obj) -> bool:
        return obj.id in (self.context.get("liked_ids") or set())


class PodcastSerializer(serializers.ModelSerializer):
    listened = serializers.SerializerMethodField()

    class Meta:
        model = Podcast
        fields = ["id", "title", "category", "duration_minutes", "icon", "audio_url", "listened"]

    def get_listened(self, obj) -> bool:
        return obj.id in (self.context.get("listened_ids") or set())


class TrafficRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrafficRule
        fields = ["id", "rule_key", "text", "has_game"]


class RecipeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Recipe
        fields = ["id", "recipe_key", "name", "intro", "ingredients", "has_game"]


class InteractionSerializer(serializers.Serializer):
    """بدنه‌ی POST /videos/{id}/interaction — هرکدام اختیاری."""

    liked = serializers.BooleanField(required=False)
    viewed = serializers.BooleanField(required=False)


class ListenSerializer(serializers.Serializer):
    seconds = serializers.IntegerField(required=False, min_value=0, max_value=24 * 3600)
