from django.urls import path

from . import views

urlpatterns = [
    path("users/me/profile", views.ProfileStatsView.as_view(), name="profile-stats"),
    path("users/me/settings", views.SettingsView.as_view(), name="settings"),
    path("users/me/lukorian", views.LukorianView.as_view(), name="lukorian"),
    path("users/me/lukorian/unlock", views.LukorianUnlockView.as_view(), name="lukorian-unlock"),
    path("users/me/lukorian/buy", views.LukorianBuyView.as_view(), name="lukorian-buy"),
    path("users/me/lukorian/custom-request", views.LukorianCustomRequestView.as_view(),
         name="lukorian-custom"),
    path("treasures", views.TreasureView.as_view(), name="treasures"),
]
