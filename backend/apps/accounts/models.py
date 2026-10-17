from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.core.validators import RegexValidator
from django.db import models
from django.db.models import Q
from django.utils import timezone

from apps.accounts.managers import UserManager
from apps.accounts.validators import validate_institution_email
from apps.common.models import SoftDeleteModel, TimeStampedModel

phone_validator = RegexValidator(
    regex=r"^\+?\d{7,15}$", message="Enter a valid contact number (digits only, optional leading +)."
)


def currently_active_faculty_q() -> Q:
    """The single source of truth for "is this faculty currently active"
    everywhere it's queried in bulk (leaderboard, directory, faculty
    count, the default faculty list) — status=ACTIVE on its own isn't
    enough once a faculty member can schedule their own departure for a
    future date (self-service "Delete Account" with a last working date):
    their row stays status=ACTIVE right up until that date, and only
    becomes effectively inactive once exit_date has actually passed —
    computed here at query time rather than needing a cron job to flip a
    field the moment midnight hits. FacultyProfile.is_currently_active is
    the same logic for a single already-loaded instance (e.g. the login
    check, which can't cheaply re-run a queryset)."""
    today = timezone.now().date()
    return Q(status=FacultyProfile.Status.ACTIVE) & (Q(exit_date__isnull=True) | Q(exit_date__gte=today))


def designation_rank_case():
    """Real academic seniority order — HOD, Deputy HOD, Professor,
    Associate Professor, Assistant Professor, Lecturer — used both as the
    Faculty Directory's primary sort (see FacultyProfileViewSet.directory)
    and the leaderboard's tiebreak below the real contribution counts
    (FacultyProfileViewSet.leaderboard). One shared definition so the two
    can never quietly disagree about what "seniority order" means."""
    from django.db.models import Case, IntegerField, When

    return Case(
        When(designation=FacultyProfile.Designation.HOD, then=0),
        When(designation=FacultyProfile.Designation.DEPUTY_HOD, then=1),
        When(designation=FacultyProfile.Designation.PROFESSOR, then=2),
        When(designation=FacultyProfile.Designation.ASSOCIATE_PROFESSOR, then=3),
        When(designation=FacultyProfile.Designation.ASSISTANT_PROFESSOR, then=4),
        When(designation=FacultyProfile.Designation.LECTURER, then=5),
        default=6,
        output_field=IntegerField(),
    )


def rd_coordinator_rank_case():
    """Secondary tiebreak, chained after designation_rank_case(): whoever
    currently holds the R&D Coordinator role (identified the same way the
    NBA report's signature block finds them — see
    apps.achievements.nba_report._find_rd_coordinator — by the phrase in
    their own bio) sorts first within their own designation tier, ahead of
    everyone else at that same rank. No name is hardcoded here: this reads
    whoever's bio says it today, so it keeps working unprompted if the role
    moves to someone else later."""
    from django.db.models import Case, IntegerField, Q, When

    return Case(
        When(
            Q(bio__icontains="r&d coordinator")
            | Q(bio__icontains="r & d coordinator")
            | Q(bio__icontains="rnd coordinator"),
            then=0,
        ),
        default=1,
        output_field=IntegerField(),
    )


class Department(TimeStampedModel):
    name = models.CharField(max_length=150, unique=True)
    code = models.CharField(max_length=20, unique=True)
    is_active = models.BooleanField(default=True)
    # Display-only. Independent of whether that person has a login account
    # here — most departments' HODs aren't system users yet, only shown on
    # the landing page / HOD directory. AI & ML's HOD (Dr. Shiwani Gupta)
    # happens to also be a real logged-in account, linked separately via
    # FacultyProfile — this field doesn't drive permissions.
    head_of_department_name = models.CharField(max_length=150, blank=True, default="")

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class User(AbstractBaseUser, PermissionsMixin):
    class Role(models.TextChoices):
        FACULTY = "faculty", "Faculty"
        HOD = "hod", "Head of Department"
        IQAC_ADMIN = "iqac_admin", "IQAC Admin"
        SUPER_ADMIN = "super_admin", "Super Admin"

    # OTP / TOTP verification at login was removed (LAN deployment): no role requires it.
    MFA_REQUIRED_ROLES = set()

    email = models.EmailField(unique=True, validators=[validate_institution_email])
    full_name = models.CharField(max_length=150)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.FACULTY)
    department = models.ForeignKey(
        Department, null=True, blank=True, on_delete=models.PROTECT, related_name="users"
    )

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    # --- MFA (Phase 1.8) ---
    mfa_enabled = models.BooleanField(default=False)
    mfa_secret = models.CharField(max_length=64, blank=True, default="")

    # --- Account lockout (Phase 1.7) ---
    failed_login_attempts = models.PositiveIntegerField(default=0)
    locked_until = models.DateTimeField(null=True, blank=True)

    # --- Personal-data lifecycle (Phase 12.2): account can be anonymized on
    # request without touching the accreditation evidence it owns.
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["full_name"]

    class Meta:
        ordering = ["full_name"]

    def __str__(self):
        return f"{self.full_name} <{self.email}>"

    @property
    def requires_mfa(self) -> bool:
        return self.role in self.MFA_REQUIRED_ROLES

    def is_locked(self) -> bool:
        from django.utils import timezone

        return bool(self.locked_until and self.locked_until > timezone.now())


class FacultyProfile(SoftDeleteModel, TimeStampedModel):
    """Every user with role faculty/hod/iqac_admin gets one of these. It is
    the achievement-ownership identity — independent of the User.role used
    for permission checks — so an HOD can submit her own achievements as
    herself *and* review everyone else's from the same account.
    """

    class Designation(models.TextChoices):
        HOD = "hod", "HOD"
        DEPUTY_HOD = "deputy_hod", "Deputy HOD"
        PROFESSOR = "professor", "Professor"
        ASSISTANT_PROFESSOR = "assistant_professor", "Assistant Professor"
        LECTURER = "lecturer", "Lecturer"
        ASSOCIATE_PROFESSOR = "associate_professor", "Associate Professor"

    class Gender(models.TextChoices):
        MALE = "male", "Male"
        FEMALE = "female", "Female"

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        EXIT_INITIATED = "exit_initiated", "Exit Initiated"
        EXITED = "exited", "Exited"

    user = models.OneToOneField("accounts.User", on_delete=models.PROTECT, related_name="faculty_profile")
    department = models.ForeignKey(Department, on_delete=models.PROTECT, related_name="faculty")
    full_name = models.CharField(max_length=150)
    designation = models.CharField(max_length=30, choices=Designation.choices)
    gender = models.CharField(max_length=10, choices=Gender.choices, blank=True, default="")
    # Self-authored "about me" text shown on the faculty's own dossier —
    # replaces a one-size-fits-all placeholder so a newly self-registered
    # faculty member isn't stuck with someone else's fabricated summary.
    bio = models.TextField(blank=True, default="")
    employee_id = models.CharField(max_length=30, unique=True)
    contact_number = models.CharField(max_length=20, blank=True, default="", validators=[phone_validator])
    join_date = models.DateField(null=True, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)

    # --- Faculty exit workflow (Phase 10) ---
    exit_initiated_at = models.DateTimeField(null=True, blank=True)
    exit_reason = models.CharField(max_length=255, blank=True, default="")
    hod_confirmed_at = models.DateTimeField(null=True, blank=True)
    hod_confirmed_by = models.ForeignKey(
        "accounts.User", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    admin_confirmed_at = models.DateTimeField(null=True, blank=True)
    admin_confirmed_by = models.ForeignKey(
        "accounts.User", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    exit_date = models.DateField(null=True, blank=True)
    last_active_department = models.ForeignKey(
        Department, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )

    class Meta:
        ordering = ["full_name"]
        indexes = [
            models.Index(fields=["department"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return f"{self.full_name} ({self.get_designation_display()})"

    @property
    def is_currently_active(self) -> bool:
        """Instance-level twin of currently_active_faculty_q() (module
        level, above) — used where a queryset filter isn't practical, e.g.
        the login check, which already has a single loaded User/profile
        and shouldn't re-run a query just to answer this."""
        if self.status != FacultyProfile.Status.ACTIVE:
            return False
        if self.exit_date and self.exit_date < timezone.now().date():
            return False
        return True


class FacultyRegistrationRequest(TimeStampedModel):
    """A self-registration whose form has already passed every validation
    check (institutional email, password strength, uniqueness, ...) but
    isn't a real account yet — created by RegisterView, promoted to a real
    User + FacultyProfile only once the department's HOD (or IQAC/Super
    Admin) approves it (FacultyRegistrationApprovalView). The plaintext
    password is never written here: `password_hash` is computed with
    make_password() at request time and assigned straight onto
    User.password at approval time, exactly like set_password() does
    internally.

    Replaces the old email-OTP verification step entirely — a human
    reviewer approving the request IS the verification now, not a code
    sent to the mailbox."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    email = models.EmailField()
    payload = models.JSONField()
    password_hash = models.CharField(max_length=128)
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name="registration_requests")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    reviewed_by = models.ForeignKey(
        "accounts.User", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["department", "status"])]

    def __str__(self):
        return f"{self.email} ({self.status})"
