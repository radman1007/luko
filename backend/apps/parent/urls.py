from django.urls import path

from . import views

urlpatterns = [
    path("children", views.ChildrenView.as_view(), name="parent-children"),
    path("children/<int:child_id>", views.ChildDetailView.as_view(), name="parent-child"),
    path("children/<int:child_id>/report", views.ChildReportView.as_view(),
         name="parent-child-report"),
]
