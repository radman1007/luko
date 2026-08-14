from django.urls import path

from . import views

urlpatterns = [
    path("moods/prompt", views.MoodPromptView.as_view(), name="mood-prompt"),
    path("moods/checkin", views.MoodCheckinView.as_view(), name="mood-checkin"),
    path("moods", views.MoodCheckinView.as_view(), name="mood-list"),
    path("breathing/sessions", views.BreathingSessionView.as_view(), name="breathing"),
    path("paintings", views.PaintingListCreateView.as_view(), name="paintings"),
    path("secrets", views.SecretListCreateView.as_view(), name="secrets"),
    path("secrets/<int:pk>", views.SecretDestroyView.as_view(), name="secret-detail"),
]
