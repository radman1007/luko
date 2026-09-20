from django.urls import path

from . import views

urlpatterns = [
    path("books", views.BookListView.as_view(), name="books"),
    path("games", views.GameListView.as_view(), name="games-list"),
    path("games/path", views.GamePathView.as_view(), name="games-path"),
    path("games/grades", views.OpenGradesView.as_view(), name="games-grades"),
    path("games/completed", views.CompletedGamesView.as_view(), name="games-completed"),
    path("games/events", views.GameEventView.as_view(), name="games-events"),
    path("games/memories", views.SeasonMemoryListCreateView.as_view(), name="memories"),
    path("games/memories/<int:pk>", views.SeasonMemoryDestroyView.as_view(),
         name="memory-detail"),
    path("games/memories/<int:pk>/image", views.SeasonMemoryImageView.as_view(),
         name="memory-image"),
    path("games/<slug:slug>/complete", views.GameCompleteView.as_view(), name="games-complete"),
    path("games/<slug:slug>/play-link", views.GamePlayLinkView.as_view(), name="games-play-link"),
]
