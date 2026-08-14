from django.urls import path

from . import views

urlpatterns = [
    path("videos", views.VideoListView.as_view(), name="videos"),
    path("videos/<int:pk>/interaction", views.VideoInteractionView.as_view(),
         name="video-interaction"),
    path("podcasts", views.PodcastListView.as_view(), name="podcasts"),
    path("podcasts/<int:pk>/listen", views.PodcastListenView.as_view(), name="podcast-listen"),
    path("traffic-rules", views.TrafficRuleView.as_view(), name="traffic-rules"),
    path("recipes", views.RecipeView.as_view(), name="recipes"),
]
