from django.urls import path

from . import views

urlpatterns = [
    path("tickets", views.TicketListCreateView.as_view(), name="tickets"),
    path("tickets/<int:pk>/reply", views.TicketReplyView.as_view(), name="ticket-reply"),
]
