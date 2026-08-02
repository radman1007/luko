from rest_framework import serializers

from .models import MissionTemplate


class SuggestMissionSerializer(serializers.Serializer):
    child_id = serializers.IntegerField()
    title = serializers.CharField(max_length=120)
    coin_reward = serializers.IntegerField(min_value=1, max_value=100, default=10)
    category = serializers.ChoiceField(
        choices=MissionTemplate.Category.choices,
        default=MissionTemplate.Category.MISSION,
    )
