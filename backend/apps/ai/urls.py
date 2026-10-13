from django.urls import path

from . import views

urlpatterns = [
    path("assistant/<int:child_id>", views.AssistantView.as_view(), name="parent-assistant"),
]
