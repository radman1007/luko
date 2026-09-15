from django.urls import path

from . import views

urlpatterns = [
    # بازنشسته: ثبت‌نام حالا اول شماره را با کدِ پیامکی تأیید می‌کند
    path("start", views.RetiredAuthView.as_view(), name="auth-start"),
    path("register", views.RetiredAuthView.as_view(), name="auth-register"),
    path("login", views.PasswordLoginView.as_view(), name="auth-login"),
    path("set-password", views.SetPasswordView.as_view(), name="auth-set-password"),
    path("verify-phone", views.VerifyPhoneView.as_view(), name="auth-verify-phone"),
    path("request-otp", views.RequestOTPView.as_view(), name="request-otp"),
    path("verify-otp", views.VerifyOTPView.as_view(), name="verify-otp"),
    path("otp-choose", views.OTPChooseView.as_view(), name="otp-choose"),
    path("me", views.MeView.as_view(), name="me"),
    path("refresh", views.RefreshView.as_view(), name="refresh"),
    path("logout", views.LogoutView.as_view(), name="logout"),
]
