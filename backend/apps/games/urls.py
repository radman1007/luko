from django.urls import path

from . import views

urlpatterns = [
    path("books", views.BookListView.as_view(), name="books"),
    path("games", views.GameListView.as_view(), name="games-list"),
    path("games/completed", views.CompletedGamesView.as_view(), name="games-completed"),
    path("games/events", views.GameEventView.as_view(), name="games-events"),
    path("games/<slug:slug>/complete", views.GameCompleteView.as_view(), name="games-complete"),
    path("games/<slug:slug>/play-link", views.GamePlayLinkView.as_view(), name="games-play-link"),
]
