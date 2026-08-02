from rest_framework import serializers

from .models import GardenShopItem


class GardenShopItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = GardenShopItem
        fields = ["item_key", "title", "description", "cost", "kind", "payload", "amount"]
