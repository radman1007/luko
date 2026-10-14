from django.urls import path

from . import views

urlpatterns = [
    path("learn", views.LearnListView.as_view(), name="parent-learn"),
    path("learn/<int:pk>", views.LearnDetailView.as_view(), name="parent-learn-item"),
    path("learn/<int:pk>/progress", views.LearnProgressView.as_view(), name="parent-learn-progress"),
]
