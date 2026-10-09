from django.urls import path

from . import views

urlpatterns = [
    path("presence/beat", views.BeatView.as_view(), name="presence-beat"),
]
