import logging
from datetime import date

from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import ProtectedError
from django.utils import timezone
from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from django.contrib.auth.hashers import make_password
from django.contrib.auth.password_validation import validate_password

from apps.accounts.captcha import generate_captcha, verify_captcha
from apps.accounts.mfa import generate_secret, provisioning_qr_data_uri, verify_totp
from apps.accounts.models import (
    Department,
    FacultyProfile,
    FacultyRegistrationRequest,
    User,
    currently_active_faculty_q,
    designation_rank_case,
    rd_coordinator_rank_case,
)
from apps.accounts.password_reset import generate_reset_challenge, verify_reset_challenge
from apps.accounts.permissions import IsIQACAdminOrAbove, IsSuperAdmin, can_manage_department_faculty
from apps.accounts.validators import role_for_designation
from apps.accounts.serializers import (
    DepartmentSerializer,
    FacultyCreateSerializer,
    FacultyProfileSerializer,
    FacultyRegistrationRequestSerializer,
    FacultyUpdateSerializer,
    MeSerializer,
    RegisterSerializer,
    TransferHODSerializer,
)
from apps.accounts.tokens import MFAPendingToken
from apps.common.throttles import LoginRateThrottle, RegisterRateThrottle
from apps.audit.models import SecurityAuditLog
from apps.notifications.services import notify_faculty_registration_pending

logger = logging.getLogger("faems")


def _client_ip(request):
    return request.META.get("REMOTE_ADDR")


def _log_security_event(request, event_type, user=None, email_attempted="", **metadata):
    SecurityAuditLog.objects.create(
        user=user,
        email_attempted=email_attempted,
        event_type=event_type,
        ip_address=_client_ip(request),
        user_agent=request.META.get("HTTP_USER_AGENT", "")[:255],
        metadata=metadata,
    )


def _issue_tokens(user):
    refresh = RefreshToken.for_user(user)
    return {"access": str(refresh.access_token), "refresh": str(refresh)}


def _try_hard_delete_faculty(profile) -> bool:
    """Attempts to actually remove the User + FacultyProfile rows —
    succeeds only for an account with zero institutional history (no
    achievements, no uploaded evidence, no generated reports, nothing
    anywhere PROTECTed against this User; a throwaway/test account being
    the common case), which then frees the email/full name/employee ID to
    register fresh immediately.

    A real contributor with any institutional history can't be
    hard-deleted at all: Django raises ProtectedError the moment
    something with on_delete=PROTECT (Achievement.faculty/created_by,
    EvidenceDocument.uploaded_by, Report.generated_by, ...) still points
    at this row — caught here and left for the caller to fall back to
    whichever soft-delete behavior it already used, since Phase 2.6 ("no
    hard deletes on accreditation evidence") must hold regardless of
    which call site this is. Catching ProtectedError rather than checking
    each relation by name keeps this correct even as new PROTECTed
    relations get added elsewhere later.

    Returns True if the account was actually removed."""
    user = profile.user
    try:
        with transaction.atomic():
            profile.delete()
            user.delete()
        return True
    except ProtectedError:
        return False


def _create_account_from_request(reg_request):
    """Promotes an approved FacultyRegistrationRequest to a real User +
    FacultyProfile — the same fields RegisterSerializer.create() sets,
    minus re-hashing the password (already hashed when the request was
    submitted). Re-checks uniqueness defensively: someone else could have
    registered this exact email/employee_id in the window since the
    request was first submitted."""
    data = reg_request.payload
    if User.objects.filter(email__iexact=data["email"]).exists():
        raise ValidationError({"detail": "An account with this email already exists."})
    if FacultyProfile.objects.filter(employee_id=data["employee_id"]).exists():
        raise ValidationError({"detail": "This employee ID is already in use."})

    with transaction.atomic():
        designation = data.get("designation") or FacultyProfile.Designation.ASSISTANT_PROFESSOR
        user = User(
            email=data["email"],
            full_name=data["full_name"],
            role=role_for_designation(designation),
            department=reg_request.department,
        )
        user.password = reg_request.password_hash
        user.save()
        profile = FacultyProfile.objects.create(
            user=user,
            department=reg_request.department,
            full_name=data["full_name"],
            designation=designation,
            gender=data.get("gender", ""),
            employee_id=data["employee_id"],
            contact_number=data.get("contact_number", ""),
            join_date=date.fromisoformat(data["join_date"]) if data.get("join_date") else None,
            date_of_birth=date.fromisoformat(data["date_of_birth"]) if data.get("date_of_birth") else None,
        )
    return profile


def _clear_registration_notifications(reg_request):
    """Approve/reject resolves this request for every HOD/admin who was
    notified about it, not just whoever clicked the button — otherwise
    anyone who acted from the Approve Faculty page (rather than the
    notification card itself) leaves a stale "awaiting your approval"
    notice sitting unread in the bell for a request that's already
    decided."""
    from apps.notifications.models import Notification

    Notification.objects.filter(
        notification_type=Notification.NotificationType.FACULTY_REGISTRATION_PENDING,
        related_evidence_id=f"regreq-{reg_request.id}",
        is_read=False,
    ).update(is_read=True)


class CaptchaView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response(generate_captcha())


class RegisterView(APIView):
    """Public self-registration: the form is fully validated (institutional
    email, password strength, uniqueness, age, HOD-slot availability, ...)
    exactly as before, but no account is created yet — a
    FacultyRegistrationRequest is created instead and the department's HOD
    (or IQAC/Super Admin, for an HOD-designation request) is notified.
    Only once they approve it (FacultyRegistrationApprovalViewSet.approve)
    does the real account get created and become able to log in.

    The plaintext password never touches the database — it's hashed here
    with make_password() and only the hash is stored on the request row,
    the same way User.set_password() would do it internally."""

    permission_classes = [permissions.AllowAny]
    throttle_classes = [RegisterRateThrottle]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        email = data["email"].lower()

        if FacultyRegistrationRequest.objects.filter(
            email__iexact=email, status=FacultyRegistrationRequest.Status.PENDING
        ).exists():
            raise ValidationError({"detail": "A registration request for this email is already awaiting approval."})

        password_hash = make_password(data.pop("password"))
        # DateField values aren't JSON-serializable as-is.
        if data.get("join_date"):
            data["join_date"] = data["join_date"].isoformat()
        if data.get("date_of_birth"):
            data["date_of_birth"] = data["date_of_birth"].isoformat()

        department = Department.objects.get(code="AIML")
        reg_request = FacultyRegistrationRequest.objects.create(
            email=email, payload=data, password_hash=password_hash, department=department,
        )
        _log_security_event(request, SecurityAuditLog.EventType.REGISTRATION_REQUESTED, email_attempted=email)
        notify_faculty_registration_pending(reg_request)
        return Response({
            "detail": "Your request has been shared with the HOD. Your account will be created once it's approved — "
                       "you'll be able to log in after that.",
            "email": email,
        })


class FacultyRegistrationApprovalViewSet(viewsets.ReadOnlyModelViewSet):
    """The HOD's "Approve Faculty" page — every self-registration for her
    department sits here, PENDING, until she acts on it. IQAC/Super Admin
    see every department's requests (same override pattern as
    FacultyProfileViewSet elsewhere); an ordinary HOD only ever sees her
    own department's."""

    serializer_class = FacultyRegistrationRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = FacultyRegistrationRequest.objects.filter(status=FacultyRegistrationRequest.Status.PENDING)
        if user.role in {User.Role.IQAC_ADMIN, User.Role.SUPER_ADMIN}:
            return qs
        if user.role == User.Role.HOD:
            return qs.filter(department_id=user.department_id)
        raise PermissionDenied("Only an HOD or IQAC/Super Admin can review registration requests.")

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        reg_request = self.get_object()
        profile = _create_account_from_request(reg_request)
        reg_request.status = FacultyRegistrationRequest.Status.APPROVED
        reg_request.reviewed_by = request.user
        reg_request.reviewed_at = timezone.now()
        reg_request.save(update_fields=["status", "reviewed_by", "reviewed_at"])
        _clear_registration_notifications(reg_request)
        _log_security_event(
            request, SecurityAuditLog.EventType.ACCOUNT_REGISTERED, user=profile.user, email_attempted=profile.user.email,
        )
        return Response(FacultyProfileSerializer(profile).data, status=201)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        reg_request = self.get_object()
        reg_request.status = FacultyRegistrationRequest.Status.REJECTED
        reg_request.reviewed_by = request.user
        reg_request.reviewed_at = timezone.now()
        reg_request.save(update_fields=["status", "reviewed_by", "reviewed_at"])
        _clear_registration_notifications(reg_request)
        _log_security_event(request, SecurityAuditLog.EventType.REGISTRATION_REJECTED, email_attempted=reg_request.email)
        return Response(status=204)


class PasswordResetRequestView(APIView):
    """Step 1 of 'Forgot password': the account's email plus the date of
    birth on file. No email/SMS is sent — matching the DOB *is* the identity
    check. Always responds the same way (and always hands back a usable
    reset_token) regardless of whether the email is actually registered, so
    this endpoint can't be used to probe which addresses have accounts."""

    permission_classes = [permissions.AllowAny]
    throttle_classes = [LoginRateThrottle]
    throttle_scope = "login"

    def post(self, request):
        email = (request.data.get("email") or "").strip().lower()
        date_of_birth = request.data.get("date_of_birth") or None
        # An HOD's real address is on a different domain than regular
        # faculty (thakureducation.org vs tcetmumbai.in) — the domain
        # dropdown defaults to the wrong one often enough that "forgot
        # password" kept failing for a reason that had nothing to do with
        # the date of birth. The domain is presentation, not part of the
        # identity check (that's what DOB is for), so this matches on the
        # local part across every allowed institutional domain instead of
        # trusting whichever one happened to be selected.
        local_part = email.split("@", 1)[0] if "@" in email else email
        candidate_emails = [f"{local_part}@{domain.lower()}" for domain in settings.ALLOWED_EMAIL_DOMAINS]
        try:
            user = User.objects.filter(email__in=candidate_emails, is_deleted=False, is_active=True).first()
            if user is None:
                raise User.DoesNotExist
            profile = getattr(user, "faculty_profile", None)
            if profile is None or not profile.date_of_birth or str(profile.date_of_birth) != str(date_of_birth):
                raise ValidationError({"detail": "That email and date of birth don't match our records."})
            token = generate_reset_challenge(user)
            _log_security_event(request, SecurityAuditLog.EventType.PASSWORD_RESET_REQUESTED, user=user, email_attempted=email)
        except User.DoesNotExist:
            raise ValidationError({"detail": "That email and date of birth don't match our records."})
        return Response({"detail": "Verified — you may now set a new password.", "reset_token": token})


class PasswordResetConfirmView(APIView):
    """Step 2: the reset_token from step 1, plus a new password."""

    permission_classes = [permissions.AllowAny]
    throttle_classes = [LoginRateThrottle]
    throttle_scope = "login"

    def post(self, request):
        reset_token = request.data.get("reset_token", "")
        new_password = request.data.get("new_password", "")

        user_id = verify_reset_challenge(reset_token)
        if user_id is None:
            raise ValidationError({"detail": "Your verification has expired. Please start over."})
        try:
            user = User.objects.get(id=user_id, is_deleted=False, is_active=True)
        except User.DoesNotExist:
            raise ValidationError({"detail": "Your verification has expired. Please start over."})

        try:
            validate_password(new_password, user=user)
        except DjangoValidationError as exc:
            # validate_password raises Django's own ValidationError, not
            # DRF's — DRF only auto-converts that inside a serializer's
            # validate_*() (see RegisterSerializer.validate_password),
            # not in a plain APIView like this one, so left uncaught it
            # became an unhandled exception and a 500 instead of the
            # actual "password too common / breached / etc." message.
            raise ValidationError({"new_password": list(exc.messages)})

        # Breach status is surfaced live while typing (see the frontend's
        # client-side strength meter), not as a submit-time gate — this
        # never blocks on it, only the hard rules above (length/complexity/
        # common-password) can reject a password.
        user.set_password(new_password)
        user.failed_login_attempts = 0
        user.locked_until = None
        user.save(update_fields=["password", "failed_login_attempts", "locked_until"])
        _log_security_event(request, SecurityAuditLog.EventType.PASSWORD_CHANGED, user=user, email_attempted=user.email)
        return Response({"detail": "Password updated. Please sign in with your new password."})


class LoginView(APIView):
    """Step 1 of login: email + password + captcha. Faculty-only accounts go
    straight to full tokens; HOD/IQAC/super-admin accounts get routed into
    the MFA step (Phase 1.8), including first-time MFA setup.
    """

    permission_classes = [permissions.AllowAny]
    throttle_classes = [LoginRateThrottle]
    throttle_scope = "login"

    def post(self, request):
        email = (request.data.get("email") or "").strip().lower()
        password = request.data.get("password") or ""
        captcha_token = request.data.get("captcha_token") or ""
        captcha_answer = request.data.get("captcha_answer")

        if not verify_captcha(captcha_token, captcha_answer):
            return Response({"detail": "Captcha verification failed. Please try again."}, status=400)

        try:
            user = User.objects.get(email__iexact=email, is_deleted=False)
        except User.DoesNotExist:
            _log_security_event(request, SecurityAuditLog.EventType.LOGIN_FAILED, email_attempted=email, reason="no_such_user")
            return Response({"detail": "Invalid email or password."}, status=401)

        if user.is_locked():
            _log_security_event(request, SecurityAuditLog.EventType.LOGIN_FAILED, user=user, email_attempted=email, reason="locked")
            return Response(
                {"detail": "This account is temporarily locked due to repeated failed login attempts. Try again later."},
                status=403,
            )

        if not user.is_active or not user.check_password(password):
            user.failed_login_attempts += 1
            locked_now = False
            if user.failed_login_attempts >= settings.LOGIN_FAILURE_LIMIT:
                user.locked_until = timezone.now() + timezone.timedelta(minutes=settings.LOGIN_LOCKOUT_MINUTES)
                locked_now = True
            user.save(update_fields=["failed_login_attempts", "locked_until"])
            _log_security_event(request, SecurityAuditLog.EventType.LOGIN_FAILED, user=user, email_attempted=email, reason="bad_password")
            if locked_now:
                _log_security_event(request, SecurityAuditLog.EventType.ACCOUNT_LOCKED, user=user, email_attempted=email)
            return Response({"detail": "Invalid email or password."}, status=401)

        # Successful password check — reset lockout counters.
        user.failed_login_attempts = 0
        user.locked_until = None
        user.save(update_fields=["failed_login_attempts", "locked_until"])

        # A scheduled self-service departure (Delete Account with a future
        # last working date) deliberately leaves is_active=True right up
        # until that date — the faculty member keeps working normally
        # until then — so this is the actual gate once it's passed, not
        # the is_active check above. Doesn't distinguish this from
        # "invalid credentials" in the response for the same reason the
        # rest of this view doesn't: no separate signal about *why* a
        # login failed, to anyone who doesn't already have valid
        # credentials for the account.
        profile = getattr(user, "faculty_profile", None)
        if profile is not None and not profile.is_currently_active:
            _log_security_event(request, SecurityAuditLog.EventType.LOGIN_FAILED, user=user, email_attempted=email, reason="exited")
            return Response({"detail": "Invalid email or password."}, status=401)

        if user.requires_mfa:
            mfa_token = str(MFAPendingToken.for_user(user))
            if not user.mfa_enabled:
                return Response(
                    {
                        "mfa_setup_required": True,
                        "mfa_token": mfa_token,
                    }
                )
            return Response({"mfa_required": True, "mfa_token": mfa_token})

        _log_security_event(request, SecurityAuditLog.EventType.LOGIN_SUCCESS, user=user, email_attempted=email)
        return Response({**_issue_tokens(user), "user": MeSerializer(user).data})


def _user_from_mfa_token(token_str):
    try:
        token = MFAPendingToken(token_str)
    except TokenError as exc:
        raise ValidationError({"mfa_token": "This MFA session has expired or is invalid. Please log in again."}) from exc
    user_id = token["user_id"]
    try:
        return User.objects.get(id=user_id, is_deleted=False)
    except User.DoesNotExist as exc:
        raise ValidationError({"mfa_token": "Account not found."}) from exc


class MFASetupView(APIView):
    """Issues a TOTP secret + QR code for a user who hasn't enabled MFA
    yet. Not activated until confirmed via MFAVerifyView.

    Reuses the existing not-yet-confirmed secret if one is already pending,
    instead of generating a new one on every call — otherwise a second
    login attempt (e.g. after a typo, or just reopening the login modal)
    silently invalidates whatever QR code the person already scanned into
    their authenticator app, and every future code from that app fails
    forever with no obvious reason why.
    """

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        user = _user_from_mfa_token(request.data.get("mfa_token", ""))
        if user.mfa_enabled:
            return Response({"detail": "MFA is already enabled for this account."}, status=400)
        if not user.mfa_secret:
            user.mfa_secret = generate_secret()
            user.save(update_fields=["mfa_secret"])
        return Response({"secret": user.mfa_secret, "qr_code": provisioning_qr_data_uri(user, user.mfa_secret)})


class MFAVerifyView(APIView):
    """Step 2 of login: confirms the TOTP code. On a user's first
    successful code, this also flips mfa_enabled on (completing setup)."""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        user = _user_from_mfa_token(request.data.get("mfa_token", ""))
        code = str(request.data.get("code", "")).strip()

        if not verify_totp(user.mfa_secret, code):
            _log_security_event(request, SecurityAuditLog.EventType.MFA_CHALLENGE_FAILED, user=user, email_attempted=user.email)
            return Response({"detail": "Incorrect authentication code."}, status=400)

        first_time = not user.mfa_enabled
        if first_time:
            user.mfa_enabled = True
            user.save(update_fields=["mfa_enabled"])
            _log_security_event(request, SecurityAuditLog.EventType.MFA_ENABLED, user=user, email_attempted=user.email)

        _log_security_event(request, SecurityAuditLog.EventType.LOGIN_SUCCESS, user=user, email_attempted=user.email, via_mfa=True)
        return Response({**_issue_tokens(user), "user": MeSerializer(user).data})


class LogoutView(APIView):
    def post(self, request):
        refresh = request.data.get("refresh")
        if refresh:
            try:
                RefreshToken(refresh).blacklist()
            except TokenError:
                pass
        _log_security_event(request, SecurityAuditLog.EventType.LOGOUT, user=request.user, email_attempted=request.user.email)
        return Response(status=204)


class MeView(APIView):
    def get(self, request):
        return Response(MeSerializer(request.user).data)


class DepartmentViewSet(viewsets.ModelViewSet):
    """Department names/codes are non-sensitive and shown on the public
    landing page (HOD directory, achievement-form preview) before login, so
    reads are open; writes stay super admin only (Phase 1.4)."""

    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.AllowAny()]
        return [IsSuperAdmin()]


class FacultyProfileViewSet(viewsets.ModelViewSet):
    """Backs the HOD Faculty Management Toolbar (Appendix A.4) — Add /
    Update / Delete (soft, routed to the exit workflow), plus role-scoped
    listing everywhere else in the app.
    """

    serializer_class = FacultyProfileSerializer
    filterset_fields = ["department"]

    def get_queryset(self):
        user = self.request.user
        qs = FacultyProfile.objects.select_related("user", "department")
        if user.role in {User.Role.IQAC_ADMIN, User.Role.SUPER_ADMIN}:
            qs = qs
        elif user.role == User.Role.HOD:
            qs = qs.filter(department_id=user.department_id)
        else:
            qs = qs.filter(user=user)

        # The active/non-active split below only makes sense for the
        # roster *listing* — every detail action (retrieve/update/destroy,
        # and the custom ones: deactivate, purge, exit/hod-confirm,
        # exit/admin-confirm, transfer's own lookups) needs to find a
        # record regardless of its current active state, scoped only by
        # department/self access above, with the action itself deciding
        # whether the record's current state is valid for it (e.g. purge
        # checks is_currently_active is False, deactivate checks it's
        # ACTIVE) — get_object() would otherwise silently 404 on a
        # perfectly real, in-scope record just because it's non-active.
        if self.action != "list":
            return qs

        # Non-active roster (Phase 10.4 archive view / the HOD-only
        # "Non-active" tab on Dossier & Evidence): anyone not currently
        # active by currently_active_faculty_q() — formally EXITED,
        # mid-workflow EXIT_INITIATED, or ACTIVE-on-paper but past their
        # own scheduled exit_date. Name/employee ID/time period and their
        # achievements stay fully visible here; nothing about "deleting"
        # a faculty member ever removes that record, only who's allowed
        # to see it and whether they can log in.
        if self.request.query_params.get("view") == "non_active":
            return qs.exclude(currently_active_faculty_q())
        # Legacy alias, kept for any existing caller: the full roster,
        # active and non-active together.
        if self.request.query_params.get("include_exited") == "true":
            return qs
        return qs.filter(currently_active_faculty_q())

    def get_serializer_class(self):
        if self.action == "create":
            return FacultyCreateSerializer
        if self.action in {"update", "partial_update"}:
            return FacultyUpdateSerializer
        return FacultyProfileSerializer

    def _assert_can_manage(self, department):
        if not can_manage_department_faculty(self.request.user, department):
            raise PermissionDenied("You can only manage faculty within your own department.")

    def _is_self(self, instance):
        own_profile = getattr(self.request.user, "faculty_profile", None)
        return own_profile is not None and own_profile.id == instance.id

    def create(self, request, *args, **kwargs):
        # DRF's default CreateModelMixin.create() re-serializes the new
        # instance with the *write* serializer (FacultyCreateSerializer) to
        # build the response — but that serializer's fields (email,
        # temporary_password, ...) don't match FacultyProfile's own
        # attributes, so `serializer.data` blows up with an AttributeError.
        # Build the response with the read serializer instead.
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        profile = serializer.instance
        read_serializer = FacultyProfileSerializer(profile, context=self.get_serializer_context())
        headers = self.get_success_headers(read_serializer.data)
        return Response(read_serializer.data, status=201, headers=headers)

    def perform_create(self, serializer):
        department = serializer.validated_data["department"]
        self._assert_can_manage(department)
        serializer.save()

    def perform_update(self, serializer):
        # "Update Details" is self-service: a faculty member may always edit
        # their own profile (email is the one thing they can't touch — it's
        # on User, not exposed by this serializer at all). Editing someone
        # else's record still requires HOD/IQAC/Super Admin standing.
        if not self._is_self(serializer.instance):
            self._assert_can_manage(serializer.instance.department)
        with transaction.atomic():
            instance = serializer.save()
            # full_name/department are denormalized onto User too (kept as
            # separate fields from FacultyProfile so an HOD's achievement-
            # ownership identity is independent of their review role) —
            # login and everything derived from the JWT (MeSerializer, the
            # header, the account dropdown) reads User, not FacultyProfile,
            # so any self-edit here has to mirror onto User or it goes
            # stale until someone fixes it by hand.
            user_updates = []
            if instance.user.full_name != instance.full_name:
                instance.user.full_name = instance.full_name
                user_updates.append("full_name")
            if instance.user.department_id != instance.department_id:
                instance.user.department = instance.department
                user_updates.append("department")
            # Role tracks designation dynamically: whoever this edit leaves
            # holding the HOD designation gets the HOD role, anyone else
            # (including a former HOD who just stepped down) gets plain
            # Faculty. Never touches IQAC Admin/Super Admin accounts — those
            # have no designation equivalent and must not be silently
            # downgraded just because their designation isn't "hod".
            if instance.user.role in {User.Role.FACULTY, User.Role.HOD}:
                new_role = role_for_designation(instance.designation)
                if instance.user.role != new_role:
                    instance.user.role = new_role
                    user_updates.append("role")
            if user_updates:
                instance.user.save(update_fields=user_updates)

    def destroy(self, request, *args, **kwargs):
        """A faculty member with zero institutional history (no
        achievements/evidence/reports — a mistakenly-added or test
        account) is actually removed, freeing their email/employee ID for
        reuse. A faculty member with any real history can never be
        hard-deleted (Phase 2.6) and instead falls back to the exact
        behavior this always had: routed into the Faculty Exit workflow
        (Phase 10) or a plain deactivation (Appendix A.4) — see
        _try_hard_delete_faculty."""
        instance = self.get_object()
        self._assert_can_manage(instance.department)
        reason = request.data.get("reason", "")
        route_to_exit = request.data.get("route_to_exit", True)
        if _try_hard_delete_faculty(instance):
            return Response(status=204)
        with transaction.atomic():
            if route_to_exit:
                instance.status = FacultyProfile.Status.EXIT_INITIATED
                instance.exit_initiated_at = timezone.now()
                instance.exit_reason = reason
                instance.save(update_fields=["status", "exit_initiated_at", "exit_reason"])
            else:
                instance.soft_delete(by_user=request.user, reason=reason)
        return Response(status=204)

    @action(detail=True, methods=["post"], url_path="purge")
    def purge(self, request, pk=None):
        """The HOD-only "Delete Data" action on a Non-active faculty
        member's card — unlike every other deletion path in this file,
        this deliberately overrides Phase 2.6's "no hard deletes on
        accreditation evidence" rule: it always removes the account *and*
        every achievement/evidence record, even with real history,
        because this is an explicit, one-at-a-time decision a human HOD
        made about one specific person's record, not an automatic
        side-effect of them leaving. Only ever reachable for someone who
        is already non-active (get_object() is scoped by get_queryset()
        to the acting HOD's own department either way) — an active
        faculty member has to go through the normal exit/delete flow
        first, never straight to this."""
        instance = self.get_object()
        self._assert_can_manage(instance.department)
        if instance.is_currently_active:
            raise ValidationError({"detail": "This faculty member is currently active — remove them from the active roster first."})
        from apps.achievements.models import Achievement, EvidenceDocument

        purged_email = instance.user.email
        with transaction.atomic():
            ach_ids = list(Achievement.all_objects.filter(faculty=instance).values_list("id", flat=True))
            EvidenceDocument.all_objects.filter(achievement_id__in=ach_ids).delete()
            Achievement.all_objects.filter(faculty=instance).delete()
            user = instance.user
            instance.delete()
            user.delete()
        _log_security_event(request, SecurityAuditLog.EventType.ACCOUNT_DELETED, email_attempted=purged_email, hod_purge=True)
        return Response(status=204)

    @action(detail=False, methods=["post"], url_path="delete-my-account")
    def delete_my_account(self, request):
        """Self-service 'Delete Account' from the profile menu — always
        requires a last working date. Two cases:

        Future date: nothing changes right now — login keeps working,
        they stay on the leaderboard/directory/faculty count exactly as
        before — only `exit_date` gets recorded. currently_active_faculty_q()
        / FacultyProfile.is_currently_active (both above) are what
        actually stop counting them as active once that date arrives, so
        there's no cron job needed to "process" this later; it's computed
        wherever activity is checked.

        Today or a past date (effectively "leaving right now"): applies
        immediately — same EXIT_INITIATED + is_active=False as the future
        case gets once its date arrives.

        Deliberately never hard-deletes, even for a test account with zero
        history: self-service deletion always has to leave something the
        HOD can see on her Non-active tab (name, employee ID, time period —
        and real achievements, if there were any), so she has a record of
        who left and when, not a silent gap. Freeing up an email/employee
        ID for a genuine do-over is the HOD's own explicit call from that
        Non-active card's "Delete Data" (purge) — never automatic here."""
        profile = getattr(request.user, "faculty_profile", None)
        if profile is None:
            raise ValidationError({"detail": "No faculty profile is linked to this account."})
        last_working_date = request.data.get("last_working_date")
        if not last_working_date:
            raise ValidationError({"last_working_date": "Your last working date is required."})
        try:
            parsed_date = date.fromisoformat(last_working_date)
        except (TypeError, ValueError):
            raise ValidationError({"last_working_date": "Enter a valid date."})

        user_email = request.user.email
        reason = request.data.get("reason", "Self-service account deletion")
        with transaction.atomic():
            profile.exit_date = parsed_date
            profile.exit_reason = reason
            update_fields = ["exit_date", "exit_reason"]
            if parsed_date <= timezone.now().date():
                profile.status = FacultyProfile.Status.EXIT_INITIATED
                profile.exit_initiated_at = timezone.now()
                update_fields += ["status", "exit_initiated_at"]
                profile.user.is_active = False
                profile.user.save(update_fields=["is_active"])
            profile.save(update_fields=update_fields)
        _log_security_event(request, SecurityAuditLog.EventType.ACCOUNT_DELETED, email_attempted=user_email)
        return Response(status=204)

    @action(detail=False, methods=["post"], url_path="transfer-hod")
    def transfer_hod(self, request):
        """The box Update Details shows when the acting HOD changes her
        own designation away from HOD: her own demotion and the
        successor's account creation happen in one atomic transaction, so
        the department's one-HOD slot is never left empty or briefly held
        by two people. Demoting herself first (inside the transaction)
        before creating the successor is what makes
        validate_hod_slot_available (via TransferHODSerializer's
        create-a-new-HOD path — there's no existing profile to exclude,
        same as FacultyCreateSerializer) see the slot as already free,
        with no special-casing needed for "the departing HOD doesn't
        count as a conflict with herself".

        Only the current HOD acting on her own profile can call this —
        an IQAC/Super Admin changing someone else's designation away from
        HOD goes through the ordinary Update Details path instead,
        unaffected by this endpoint.

        `successor_mode` picks which of two ways the incoming HOD is
        identified: "existing" promotes an already-registered faculty
        member from the same department (no new login created — she
        just keeps logging in with her own password, now with HOD
        access); "new" (the default, for backward compatibility) is the
        original create-a-fresh-account path below."""
        acting_profile = getattr(request.user, "faculty_profile", None)
        if acting_profile is None or request.user.role != User.Role.HOD:
            raise PermissionDenied("Only the current HOD can transfer this role.")

        new_own_designation = request.data.get("new_designation")
        valid_designations = {c[0] for c in FacultyProfile.Designation.choices}
        if not new_own_designation or new_own_designation == FacultyProfile.Designation.HOD:
            raise ValidationError({"new_designation": "Choose the designation you're changing to (not HOD)."})
        if new_own_designation not in valid_designations:
            raise ValidationError({"new_designation": "Not a valid designation."})

        successor_mode = request.data.get("successor_mode", "new")
        if successor_mode not in {"new", "existing"}:
            raise ValidationError({"successor_mode": "Must be 'new' or 'existing'."})

        if successor_mode == "existing":
            successor_faculty_id = request.data.get("successor_faculty_id")
            if not successor_faculty_id:
                raise ValidationError({"successor_faculty_id": "Select who the role is being transferred to."})
            successor_profile = (
                FacultyProfile.objects.select_related("user")
                .filter(department=acting_profile.department)
                .exclude(id=acting_profile.id)
                .filter(id=successor_faculty_id)
                .first()
            )
            if successor_profile is None:
                raise ValidationError(
                    {"successor_faculty_id": "No faculty member with that ID in your department."}
                )
            if not successor_profile.is_currently_active:
                raise ValidationError({"successor_faculty_id": "That faculty member is not currently active."})

            with transaction.atomic():
                acting_profile.designation = new_own_designation
                acting_profile.save(update_fields=["designation"])
                if request.user.role in {User.Role.FACULTY, User.Role.HOD}:
                    request.user.role = role_for_designation(new_own_designation)
                    request.user.save(update_fields=["role"])

                successor_profile.designation = FacultyProfile.Designation.HOD
                successor_profile.save(update_fields=["designation"])
                successor_profile.user.role = User.Role.HOD
                successor_profile.user.save(update_fields=["role"])

            return Response(
                {
                    "acting_profile": FacultyProfileSerializer(acting_profile).data,
                    "successor": FacultyProfileSerializer(successor_profile).data,
                },
                status=200,
            )

        successor_serializer = TransferHODSerializer(data=request.data.get("successor") or {})
        successor_serializer.is_valid(raise_exception=True)
        data = successor_serializer.validated_data

        with transaction.atomic():
            acting_profile.designation = new_own_designation
            acting_profile.save(update_fields=["designation"])
            if request.user.role in {User.Role.FACULTY, User.Role.HOD}:
                request.user.role = role_for_designation(new_own_designation)
                request.user.save(update_fields=["role"])

            password = data.pop("temporary_password")
            title = data.pop("title")
            full_name = f"{title} {data['full_name']}".strip()
            successor_user = User.objects.create_user(
                email=data["email"],
                password=password,
                full_name=full_name,
                role=User.Role.HOD,
                department=acting_profile.department,
            )
            successor_profile = FacultyProfile.objects.create(
                user=successor_user,
                department=acting_profile.department,
                full_name=full_name,
                designation=FacultyProfile.Designation.HOD,
                employee_id=data["employee_id"],
                join_date=data.get("join_date"),
                date_of_birth=data.get("date_of_birth"),
            )

        return Response(
            {
                "acting_profile": FacultyProfileSerializer(acting_profile).data,
                "successor": FacultyProfileSerializer(successor_profile).data,
            },
            status=201,
        )

    @action(detail=False, methods=["get"], url_path="leaderboard")
    def leaderboard(self, request):
        """Institution-wide contribution ranking — verified-achievement
        counts per active faculty member. Aggregate counts only (names,
        designation, department, counts); never the underlying achievement
        details, which stay behind the normal per-record RBAC."""
        from django.db.models import Count, Q

        from apps.achievements.models import Achievement

        # Tiebreak below the real counts: when nobody's actually ahead on
        # verified/submitted work (e.g. a freshly onboarded department
        # where everyone's still at zero), rank by institutional role
        # rather than alphabetically by name — HOD first, then descending
        # seniority — so the ranking reads as a sane default order instead
        # of looking arbitrary. Within the same seniority tier, whoever is
        # R&D Coordinator sorts first (rd_coordinator_rank_case) — same
        # rule the Faculty Directory below uses.
        designation_rank = designation_rank_case()

        qs = (
            FacultyProfile.objects.filter(currently_active_faculty_q())
            .exclude(user__email__istartswith="guest.")
            .select_related("department")
            .annotate(
                # Count(..., filter=...) across a reverse FK compiles straight
                # to a SQL JOIN — it never goes through Achievement.objects'
                # SoftDeleteManager, so without an explicit is_deleted=False
                # here, every soft-deleted achievement (drafts discarded,
                # attachments' parent submissions removed, anything a
                # faculty member has since deleted) kept silently counting
                # toward these totals forever. This was the actual reason
                # "deleting doesn't update the leaderboard" kept recurring.
                verified_count=Count(
                    "achievements",
                    filter=Q(achievements__status__in=[Achievement.Status.VERIFIED, Achievement.Status.IQAC_LOCKED])
                    & Q(achievements__is_deleted=False),
                    distinct=True,
                ),
                submitted_count=Count(
                    "achievements",
                    filter=~Q(achievements__status=Achievement.Status.DRAFT) & Q(achievements__is_deleted=False),
                    distinct=True,
                ),
                designation_rank=designation_rank,
                rd_coordinator_rank=rd_coordinator_rank_case(),
            )
            .order_by("-verified_count", "-submitted_count", "designation_rank", "rd_coordinator_rank", "full_name")
        )

        results = [
            {
                "id": f.id,
                "full_name": f.full_name,
                "designation": f.get_designation_display(),
                "department_code": f.department.code,
                "department_name": f.department.name,
                "verified_count": f.verified_count,
                "submitted_count": f.submitted_count,
            }
            for f in qs
        ]
        return Response({"results": results})

    @action(detail=False, methods=["get"], url_path="directory")
    def directory(self, request):
        """The public-within-the-app faculty directory (the carousel of
        cards on the Faculties section) — every active faculty member's
        name, title and self-written bio, visible to any signed-in user
        regardless of role. Deliberately separate from the default list()
        action above, which stays RBAC-scoped (self-only for plain faculty,
        department-only for HOD) for the HOD roster-management use case;
        this action exists so a browsing faculty member can see the whole
        department's directory without that self-only restriction, while
        still leaving out anything sensitive (email, contact number,
        exit/HR workflow fields)."""
        department_id = request.query_params.get("department")
        qs = (
            FacultyProfile.objects.filter(currently_active_faculty_q())
            .exclude(user__email__istartswith="guest.")
            .select_related("department")
            .annotate(designation_rank=designation_rank_case(), rd_coordinator_rank=rd_coordinator_rank_case())
            .order_by("designation_rank", "rd_coordinator_rank", "full_name")
        )
        if department_id:
            qs = qs.filter(department_id=department_id)

        results = [
            {
                "id": f.id,
                "full_name": f.full_name,
                "designation": f.designation,
                "department_code": f.department.code,
                "department_name": f.department.name,
                "employee_id": f.employee_id,
                "bio": f.bio,
            }
            for f in qs
        ]
        return Response({"results": results})

    @action(detail=False, methods=["get"], url_path="nba-report")
    def nba_report(self, request):
        """The HOD's NBA Criterion 6 report for a given month/year —
        generated fresh on every request (never a stored file) from
        whatever's actually in the database right now. Defaults to the
        current month/year when ?month=/&year= aren't given. HOD-only,
        deliberately: unlike the rest of this viewset, IQAC/Super Admin
        don't get an override here."""
        if request.user.role != User.Role.HOD:
            raise PermissionDenied("Only the HOD can generate this report.")
        profile = getattr(request.user, "faculty_profile", None)
        if profile is None:
            raise ValidationError({"detail": "Your account has no department to report on."})

        from apps.achievements.nba_report import available_report_years, generate_monthly_nba_report

        today = timezone.localdate()
        month_param = request.query_params.get("month")
        year_param = request.query_params.get("year")
        try:
            month = int(month_param) if month_param else today.month
            year = int(year_param) if year_param else today.year
        except (TypeError, ValueError):
            raise ValidationError({"detail": "month and year must be numbers."})
        if not 1 <= month <= 12:
            raise ValidationError({"month": "Must be between 1 and 12."})
        if year not in available_report_years():
            raise ValidationError({"year": "Not an available report year."})

        buffer = generate_monthly_nba_report(profile.department, month, year)
        filename = f"NBA-Criterion6-{profile.department.code}-{year}-{month:02d}.pdf"
        from django.http import FileResponse

        response = FileResponse(buffer, content_type="application/pdf", filename=filename, as_attachment=True)
        return response

    @action(detail=False, methods=["get"], url_path="nba-report-years")
    def nba_report_years(self, request):
        """The year options for the report's Month/Year picker — see
        available_report_years' docstring for why this never needs an
        explicit "add year" step."""
        if request.user.role != User.Role.HOD:
            raise PermissionDenied("Only the HOD can generate this report.")
        from apps.achievements.nba_report import available_report_years

        return Response({"years": available_report_years()})

    @action(detail=True, methods=["post"], url_path="exit/hod-confirm")
    def hod_confirm_exit(self, request, pk=None):
        """Step 2 of the exit workflow (Phase 10.1): Exit Initiated → HOD
        Confirms. Only the department's own HOD (or IQAC/super admin) may
        confirm."""
        instance = self.get_object()
        self._assert_can_manage(instance.department)
        if instance.status != FacultyProfile.Status.EXIT_INITIATED:
            raise ValidationError({"detail": "This faculty member is not currently in the exit-initiated state."})
        instance.hod_confirmed_at = timezone.now()
        instance.hod_confirmed_by = request.user
        instance.save(update_fields=["hod_confirmed_at", "hod_confirmed_by"])
        return Response(FacultyProfileSerializer(instance).data)

    @action(detail=True, methods=["post"], url_path="exit/admin-confirm", permission_classes=[IsIQACAdminOrAbove])
    def admin_confirm_exit(self, request, pk=None):
        """Step 3 + 4 of the exit workflow: Admin Confirms → Account
        Disabled → Archived. Never deletes or moves achievement/evidence —
        they stay linked to the original department and faculty id."""
        instance = self.get_object()
        if not instance.hod_confirmed_at:
            raise ValidationError({"detail": "HOD confirmation is required before admin confirmation."})
        with transaction.atomic():
            instance.admin_confirmed_at = timezone.now()
            instance.admin_confirmed_by = request.user
            instance.exit_date = timezone.now().date()
            instance.last_active_department = instance.department
            instance.status = FacultyProfile.Status.EXITED
            instance.save(
                update_fields=[
                    "admin_confirmed_at",
                    "admin_confirmed_by",
                    "exit_date",
                    "last_active_department",
                    "status",
                ]
            )
            instance.user.is_active = False
            instance.user.save(update_fields=["is_active"])
        return Response(FacultyProfileSerializer(instance).data)

    @action(detail=True, methods=["post"], url_path="deactivate")
    def deactivate(self, request, pk=None):
        """A one-step alternative to the full exit/hod-confirm +
        exit/admin-confirm chain above, for the common case: an HOD (or
        IQAC/Super Admin) marking someone who has actually left, directly
        from that faculty member's own dossier. Same end state as the full
        workflow (status EXITED, login disabled, excluded from the
        leaderboard/directory, which both already filter to ACTIVE) and the
        same audit fields populated, just collapsed into a single action by
        one authorized person instead of requiring a second person to
        separately confirm."""
        instance = self.get_object()
        self._assert_can_manage(instance.department)
        if instance.status != FacultyProfile.Status.ACTIVE:
            raise ValidationError({"detail": "This faculty member is not currently active."})
        exit_date = request.data.get("exit_date")
        if not exit_date:
            raise ValidationError({"exit_date": "The last working date is required."})
        with transaction.atomic():
            instance.status = FacultyProfile.Status.EXITED
            instance.exit_date = exit_date
            instance.exit_initiated_at = timezone.now()
            instance.exit_reason = request.data.get("reason", "Marked as exited from their dossier.")
            instance.hod_confirmed_at = timezone.now()
            instance.hod_confirmed_by = request.user
            instance.admin_confirmed_at = timezone.now()
            instance.admin_confirmed_by = request.user
            instance.last_active_department = instance.department
            instance.save(
                update_fields=[
                    "status",
                    "exit_date",
                    "exit_initiated_at",
                    "exit_reason",
                    "hod_confirmed_at",
                    "hod_confirmed_by",
                    "admin_confirmed_at",
                    "admin_confirmed_by",
                    "last_active_department",
                ]
            )
            instance.user.is_active = False
            instance.user.save(update_fields=["is_active"])
        return Response(FacultyProfileSerializer(instance).data)
