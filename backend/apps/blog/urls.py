from django.urls import path

from . import views

urlpatterns = [
    path("blog/posts", views.PostListView.as_view(), name="blog-posts"),
    path("blog/posts/<str:slug>", views.PostDetailView.as_view(), name="blog-post"),
]
