from django.urls import path

from . import views

urlpatterns = [
    path("notices", views.KidNoticesView.as_view(), name="kid-notices"),
    path("notices/read", views.KidNoticesReadView.as_view(), name="kid-notices-read"),
]
