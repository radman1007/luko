from django.urls import path

from . import views

urlpatterns = [
    path("sync", views.AccountSyncView.as_view(), name="account-sync"),
]
