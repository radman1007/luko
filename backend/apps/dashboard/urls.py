from django.urls import path

from .views import audit_log, auth, billing, blog, concepts, notices, overview, podcasts, staff, tickets, users

urlpatterns = [
    path("auth/csrf", auth.CsrfView.as_view()),
    path("auth/login", auth.LoginView.as_view()),
    path("auth/resend", auth.ResendView.as_view()),
    path("auth/verify", auth.VerifyView.as_view()),
    path("auth/logout", auth.LogoutView.as_view()),
    path("me", auth.MeView.as_view()),
    path("meta", auth.MetaView.as_view()),

    path("overview", overview.OverviewView.as_view()),
    path("analytics", overview.AnalyticsView.as_view()),
    path("online", overview.OnlineView.as_view()),

    path("users", users.UserListView.as_view()),
    path("users/<int:pk>", users.UserDetailView.as_view()),
    path("users/<int:pk>/logout-all", users.UserLogoutAllView.as_view()),

    path("payments", billing.PaymentListView.as_view()),
    path("payments/gift", billing.GiftView.as_view()),
    path("payments/<int:pk>/revoke", billing.RevokeGiftView.as_view()),

    path("tickets", tickets.TicketListView.as_view()),
    path("tickets/<int:pk>", tickets.TicketDetailView.as_view()),
    path("tickets/<int:pk>/reply", tickets.TicketReplyView.as_view()),
    path("tickets/<int:pk>/status", tickets.TicketStatusView.as_view()),

    path("podcasts", podcasts.PodcastListView.as_view()),
    path("podcasts/<int:pk>", podcasts.PodcastDetailView.as_view()),

    path("blog", blog.PostListView.as_view()),
    path("blog/images", blog.BlogImageView.as_view()),
    path("blog/preview", blog.BlogPreviewView.as_view()),
    path("blog/<int:pk>", blog.PostDetailView.as_view()),

    path("concepts", concepts.ConceptListView.as_view()),
    path("concepts/unknown", concepts.UnknownConceptView.as_view()),
    path("concepts/<int:pk>", concepts.ConceptDetailView.as_view()),

    path("notices", notices.NoticeHistoryView.as_view()),
    path("notices/preview", notices.NoticePreviewView.as_view()),
    path("notices/send", notices.NoticeSendView.as_view()),

    path("staff", staff.StaffListView.as_view()),
    path("staff/<int:pk>", staff.StaffDetailView.as_view()),
    path("staff/<int:pk>/password", staff.StaffPasswordView.as_view()),

    path("audit", audit_log.AuditListView.as_view()),
]
