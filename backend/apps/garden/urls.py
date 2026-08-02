from django.urls import path

from . import views

urlpatterns = [
    path("state", views.GardenStateView.as_view(), name="garden-state"),
    path("water", views.GardenWaterView.as_view(), name="garden-water"),
    path("fertilize", views.GardenFertilizeView.as_view(), name="garden-fertilize"),
    path("plant", views.GardenPlantView.as_view(), name="garden-plant"),
    path("buy", views.GardenBuyView.as_view(), name="garden-buy"),
    path("shop", views.GardenShopView.as_view(), name="garden-shop"),
]
