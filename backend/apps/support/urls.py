from django.urls import path

from . import views

urlpatterns = [
    path("tickets", views.TicketListCreateView.as_view(), name="tickets"),
    path("tickets/<int:pk>", views.TicketDetailView.as_view(), name="ticket-detail"),
    path("tickets/<int:pk>/reply", views.TicketReplyView.as_view(), name="ticket-reply"),
    path("tickets/<int:pk>/close", views.TicketCloseView.as_view(), name="ticket-close"),
    path("tickets/<int:pk>/rate", views.TicketRateView.as_view(), name="ticket-rate"),
]
