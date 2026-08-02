from django.urls import path

from . import views

urlpatterns = [
    path("summary", views.ClubSummaryView.as_view(), name="club-summary"),
    path("missions", views.MissionsView.as_view(), name="club-missions"),
    path("sports", views.SportsView.as_view(), name="club-sports"),
    path("medals", views.MedalsView.as_view(), name="club-medals"),
    path("shop", views.ShopView.as_view(), name="club-shop"),
    path("missions/<int:template_id>/complete", views.CompleteMissionView.as_view(),
         name="club-complete"),
    path("shop/<slug:item_key>/redeem", views.RedeemView.as_view(), name="club-redeem"),
    path("suggest", views.SuggestMissionView.as_view(), name="club-suggest"),
]
