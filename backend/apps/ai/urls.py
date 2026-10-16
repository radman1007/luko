from django.urls import path

from . import views

urlpatterns = [
    path("assistant/<int:child_id>", views.AssistantView.as_view(), name="parent-assistant"),
    path("assistant/<int:child_id>/conversations", views.ConversationListView.as_view(),
         name="parent-assistant-conversations"),
    path("children/<int:child_id>/paintings", views.PaintingListView.as_view(), name="parent-paintings"),
    path("children/<int:child_id>/paintings/<int:painting_id>", views.PaintingDetailView.as_view(),
         name="parent-painting"),
]
