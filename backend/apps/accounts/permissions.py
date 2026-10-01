from rest_framework.permissions import BasePermission

from apps.accounts.models import User


class IsSuperAdmin(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == User.Role.SUPER_ADMIN)


class IsIQACAdmin(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == User.Role.IQAC_ADMIN)


class IsHOD(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == User.Role.HOD)


class IsHODOrAbove(BasePermission):
    """HOD, IQAC admin, or super admin — used for department-wide review
    actions."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in {User.Role.HOD, User.Role.IQAC_ADMIN, User.Role.SUPER_ADMIN}
        )


class IsIQACAdminOrAbove(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in {User.Role.IQAC_ADMIN, User.Role.SUPER_ADMIN}
        )


def can_manage_department_faculty(user, department) -> bool:
    """Server-side rule for the HOD Faculty Management Toolbar (Appendix
    A.4): an HOD may only add/update/soft-delete faculty within her own
    department; IQAC/super admin can act department-wide."""
    if not user or not user.is_authenticated:
        return False
    if user.role in {User.Role.IQAC_ADMIN, User.Role.SUPER_ADMIN}:
        return True
    if user.role == User.Role.HOD:
        return user.department_id == getattr(department, "id", department)
    return False


def _own_faculty_profile_id(user):
    """`faculty_profile` is the reverse side of a OneToOneField (defined on
    FacultyProfile, not User), so Django never creates a `faculty_profile_id`
    shortcut on User — only `FacultyProfile.user_id` exists. Resolve it
    explicitly instead, and treat "no profile" as no match rather than an
    error."""
    profile = getattr(user, "faculty_profile", None)
    return profile.id if profile else None


def can_access_faculty_profile(user, faculty_profile) -> bool:
    """Own-data-vs-department rule (Appendix A.4), enforced server-side —
    this is the IDOR boundary, not just a hidden UI element."""
    if not user or not user.is_authenticated:
        return False
    if user.role in {User.Role.IQAC_ADMIN, User.Role.SUPER_ADMIN}:
        return True
    if user.role == User.Role.HOD and user.department_id == faculty_profile.department_id:
        return True
    return _own_faculty_profile_id(user) == faculty_profile.id


def can_access_achievement(user, achievement) -> bool:
    """Same IDOR boundary, applied to an achievement/evidence record: owner
    or department HOD/IQAC/super admin only. A faculty user can never fetch
    another faculty's record by guessing/changing an id (Phase 12.4)."""
    if not user or not user.is_authenticated:
        return False
    if user.role in {User.Role.IQAC_ADMIN, User.Role.SUPER_ADMIN}:
        return True
    if user.role == User.Role.HOD and user.department_id == achievement.faculty.department_id:
        return True
    return _own_faculty_profile_id(user) == achievement.faculty_id


def is_achievement_owner(user, achievement) -> bool:
    """Deliberately narrower than can_access_achievement: HOD/IQAC/Super
    Admin can view and verify a record, but add/remove/delete is the
    submitting faculty member's own action only — they're the one
    responsible for what's in their dossier, reviewers are not editors."""
    if not user or not user.is_authenticated:
        return False
    return _own_faculty_profile_id(user) == achievement.faculty_id


def can_manage_non_active_faculty_record(user, faculty_profile) -> bool:
    """A deliberate, narrower override of is_achievement_owner, mirroring
    FacultyProfileViewSet.purge's own override of the "preserve for
    accreditation" default — just at individual-attachment/individual-
    submission granularity instead of the whole account. Once a faculty
    member is non-active they can no longer log in to clean up their own
    dossier themselves, so whoever can already manage their account at
    all (their own department's HOD, or IQAC/Super Admin — same
    can_manage_department_faculty rule purge uses) can also delete a
    single stray attachment or submission from their dossier one at a
    time, without purging the entire account. Never applies to a
    currently-active faculty member's record — that stays owner-only,
    same as everyone else's."""
    if not can_manage_department_faculty(user, faculty_profile.department):
        return False
    return not faculty_profile.is_currently_active
