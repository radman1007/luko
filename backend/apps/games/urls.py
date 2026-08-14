from django.urls import path

from . import views

urlpatterns = [
    path("books", views.BookListView.as_view(), name="books"),
    path("games", views.GameListView.as_view(), name="games-list"),
    path("games/events", views.GameEventView.as_view(), name="games-events"),
    path("games/<slug:slug>/complete", views.GameCompleteView.as_view(), name="games-complete"),
]
