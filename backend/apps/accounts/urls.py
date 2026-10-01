from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from apps.accounts.views import (
    CaptchaView,
    DepartmentViewSet,
    FacultyProfileViewSet,
    FacultyRegistrationApprovalViewSet,
    LoginView,
    LogoutView,
    MeView,
    MFASetupView,
    MFAVerifyView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    RegisterView,
)
from django.urls import path

router = DefaultRouter()
router.register("departments", DepartmentViewSet, basename="department")
router.register("faculty", FacultyProfileViewSet, basename="faculty-profile")
router.register("faculty-registration-requests", FacultyRegistrationApprovalViewSet, basename="faculty-registration-request")

urlpatterns = [
    path("auth/captcha/", CaptchaView.as_view(), name="captcha"),
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/mfa/setup/", MFASetupView.as_view(), name="mfa-setup"),
    path("auth/mfa/verify/", MFAVerifyView.as_view(), name="mfa-verify"),
    path("auth/logout/", LogoutView.as_view(), name="logout"),
    path("auth/password-reset/request/", PasswordResetRequestView.as_view(), name="password-reset-request"),
    path("auth/password-reset/confirm/", PasswordResetConfirmView.as_view(), name="password-reset-confirm"),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("auth/me/", MeView.as_view(), name="me"),
    *router.urls,
]
