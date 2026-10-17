import hashlib
import logging
import re

from django.conf import settings
from django.core.exceptions import ValidationError

logger = logging.getLogger("faems")


def validate_institution_email(email: str) -> None:
    """Server-side enforcement that every account is a Thakur institution
    address — this is the actual security boundary, the frontend check is
    just UX. Applies to every account-creation path: super admin creating a
    department head, HOD adding faculty, and public self-registration.
    """
    domains = [d.lower() for d in settings.ALLOWED_EMAIL_DOMAINS]
    if not any(email.lower().endswith("@" + d) for d in domains):
        allowed = " or ".join(f"@{d}" for d in domains)
        raise ValidationError(f"Email must be an institutional address ending in {allowed}.")


def email_variants(email: str) -> list[str]:
    """Every faculty member has an address on both institutional domains
    (name@tcetmumbai.in and name@thakureducation.org). Returns the same
    local part on each allowed domain, the typed one first, so an account
    registered with either address is found by either."""
    typed = (email or "").strip().lower()
    local, _, domain = typed.partition("@")
    domains = [d.lower() for d in settings.ALLOWED_EMAIL_DOMAINS]
    if not local or domain not in domains:
        return [typed]
    return [typed] + [f"{local}@{d}" for d in domains if d != domain]


def find_user_by_any_domain(email: str):
    """The (non-deleted) user whose registered address matches this one on
    either institutional domain, preferring the exact address typed."""
    from apps.accounts.models import User

    for candidate in email_variants(email):
        user = User.objects.filter(email__iexact=candidate, is_deleted=False).first()
        if user:
            return user
    return None


def user_email_exists(email: str) -> bool:
    """True if this person already has an account on either domain."""
    from apps.accounts.models import User

    return any(User.objects.filter(email__iexact=c).exists() for c in email_variants(email))


def role_for_designation(designation):
    """Single source of truth for "does this job title carry department
    review/verification authority": whoever currently holds the HOD
    designation gets the HOD role, and only that designation does — every
    other title (Deputy HOD included) gets the plain Faculty role. Called
    everywhere designation is set or changed (self-registration, Update
    Details, Add Faculty) so role always tracks designation dynamically,
    with no separate admin action needed to promote or demote someone.

    Deliberately never returns IQAC_ADMIN/SUPER_ADMIN — those are elevated
    admin roles with no designation equivalent, granted out-of-band, and
    callers editing an *existing* account must guard against downgrading
    one of those just because its designation isn't "hod" (see
    FacultyProfileViewSet.perform_update).
    """
    from apps.accounts.models import FacultyProfile, User

    return User.Role.HOD if designation == FacultyProfile.Designation.HOD else User.Role.FACULTY


def validate_hod_slot_available(designation, department, exclude_profile_id=None) -> None:
    """One HOD per department, enforced at every point a designation can be
    set to HOD — self-registration, Update Details, and Add Faculty — the
    same three call sites role_for_designation already documents. Without
    this, two people could simultaneously hold designation=HOD (and so,
    via role_for_designation, both get HOD's department-wide review
    authority) with no single source of truth for who the real HOD is.

    `exclude_profile_id` lets the *current* HOD keep saving her own record
    without this treating her as a conflicting second HOD; every other
    caller (a brand-new registration, or someone else being edited) passes
    nothing, so it's compared against everyone.

    Deliberately silent (no-op) for every other designation — this is not
    a general "one person per title" rule, only HOD has an exclusive
    department-wide authority slot that makes a second holder a real
    problem (Deputy HOD and the rest are ordinary faculty titles that can
    be held by any number of people)."""
    from apps.accounts.models import FacultyProfile

    if designation != FacultyProfile.Designation.HOD:
        return
    existing = FacultyProfile.objects.filter(
        department=department,
        designation=FacultyProfile.Designation.HOD,
        status=FacultyProfile.Status.ACTIVE,
    )
    if exclude_profile_id:
        existing = existing.exclude(id=exclude_profile_id)
    current_hod = existing.first()
    if current_hod:
        raise ValidationError(
            f"{department.name} already has an HOD ({current_hod.full_name}). "
            "Only one HOD is allowed per department at a time. They need to change "
            "their own designation first."
        )


class ComplexityValidator:
    """At least one uppercase, one lowercase, one digit, one symbol
    (playbook Phase 1.6). Length is handled by Django's own MinimumLength
    validator, kept separate in AUTH_PASSWORD_VALIDATORS.
    """

    def validate(self, password, user=None):
        if not re.search(r"[A-Z]", password):
            raise ValidationError("Password must contain at least one uppercase letter.", code="password_no_upper")
        if not re.search(r"[a-z]", password):
            raise ValidationError("Password must contain at least one lowercase letter.", code="password_no_lower")
        if not re.search(r"\d", password):
            raise ValidationError("Password must contain at least one digit.", code="password_no_digit")
        if not re.search(r"[^A-Za-z0-9]", password):
            raise ValidationError("Password must contain at least one symbol.", code="password_no_symbol")

    def get_help_text(self):
        return "Your password must include an uppercase letter, a lowercase letter, a digit, and a symbol."


_HIBP_RANGE_API = "https://api.pwnedpasswords.com/range/"


def password_breach_warning(password: str) -> str | None:
    """Checks the password against the Have I Been Pwned k-anonymity range
    API. Deliberately a warning, not a hard rule: a breach hit means this
    exact password is known to attackers (so it's worth steering someone
    away from), not that it fails our own strength requirements — those are
    ComplexityValidator + Django's length/common-password checks, which
    still apply as hard blocks regardless of this. The caller decides
    whether to let the person proceed anyway (see RegisterView /
    PasswordResetConfirmView's confirm_weak_password), the same "we'd
    recommend against it, but it's your call" pattern most consumer signup
    flows use instead of an outright block.

    Best-effort like the rest of this module: if HIBP is unreachable (e.g.
    the college server has no outbound internet), this logs and returns
    None rather than blocking on a third-party outage.
    """
    try:
        import requests

        sha1 = hashlib.sha1(password.encode("utf-8")).hexdigest().upper()
        prefix, suffix = sha1[:5], sha1[5:]
        response = requests.get(_HIBP_RANGE_API + prefix, timeout=2)
        response.raise_for_status()
        for line in response.text.splitlines():
            candidate_suffix, _, _count = line.partition(":")
            if candidate_suffix == suffix:
                return "This password has appeared in a known data breach. We'd recommend choosing a different one."
    except Exception as exc:  # noqa: BLE001 - deliberately broad, see docstring
        logger.warning("Breached-password check skipped (HIBP unreachable): %s", exc)
    return None
