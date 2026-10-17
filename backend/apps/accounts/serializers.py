import datetime
import re

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from apps.accounts.models import Department, FacultyProfile, User
from apps.accounts.validators import (
    role_for_designation,
    user_email_exists,
    validate_hod_slot_available,
    validate_institution_email,
)

MINIMUM_REGISTRATION_AGE_YEARS = 18
MINIMUM_BIRTH_YEAR = 1965
MINIMUM_JOIN_YEAR = 2022


def _validate_minimum_age(dob):
    if dob is None:
        return
    today = timezone.localdate()
    age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    if age < MINIMUM_REGISTRATION_AGE_YEARS:
        raise serializers.ValidationError(
            f"You must be at least {MINIMUM_REGISTRATION_AGE_YEARS} years old to register."
        )
    if dob > today:
        raise serializers.ValidationError("Date of birth cannot be in the future.")
    if dob.year < MINIMUM_BIRTH_YEAR:
        raise serializers.ValidationError(f"Date of birth cannot be before {MINIMUM_BIRTH_YEAR}.")


def _validate_join_date_range(join_date):
    if join_date is None:
        return
    today = timezone.localdate()
    if join_date > today:
        raise serializers.ValidationError("Date of joining cannot be in the future.")
    if join_date.year < MINIMUM_JOIN_YEAR:
        raise serializers.ValidationError(f"Date of joining cannot be before {MINIMUM_JOIN_YEAR}.")


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ["id", "name", "code", "is_active", "head_of_department_name", "created_at"]


class UserSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "full_name", "role", "department", "mfa_enabled"]


class MeSerializer(serializers.ModelSerializer):
    department = DepartmentSerializer(read_only=True)
    faculty_profile_id = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "full_name",
            "role",
            "department",
            "mfa_enabled",
            "requires_mfa",
            "faculty_profile_id",
        ]

    def get_faculty_profile_id(self, obj):
        return getattr(obj, "faculty_profile", None) and obj.faculty_profile.id


class FacultyProfileSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="user.email", read_only=True)
    role = serializers.ChoiceField(source="user.role", choices=User.Role.choices, read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True)

    last_active_department_name = serializers.CharField(source="last_active_department.name", read_only=True)

    class Meta:
        model = FacultyProfile
        fields = [
            "id",
            "email",
            "role",
            "full_name",
            "department",
            "department_name",
            "designation",
            "gender",
            "bio",
            "employee_id",
            "contact_number",
            "join_date",
            "date_of_birth",
            "status",
            "exit_initiated_at",
            "exit_reason",
            "hod_confirmed_at",
            "admin_confirmed_at",
            "exit_date",
            "last_active_department_name",
            "created_at",
        ]
        read_only_fields = [
            "status",
            "exit_initiated_at",
            "hod_confirmed_at",
            "admin_confirmed_at",
            "exit_date",
        ]


class FacultyCreateSerializer(serializers.Serializer):
    """Backs the HOD's 'Add' toolbar action (Appendix A.4): creates a User +
    linked FacultyProfile atomically, scoped to the acting HOD's department
    (or an explicit department for IQAC/super admin).
    """

    email = serializers.EmailField()
    full_name = serializers.CharField(max_length=150)
    designation = serializers.ChoiceField(choices=FacultyProfile.Designation.choices)
    employee_id = serializers.CharField(max_length=30)
    contact_number = serializers.CharField(max_length=20, required=False, allow_blank=True)
    join_date = serializers.DateField(required=False, allow_null=True)
    department = serializers.PrimaryKeyRelatedField(queryset=Department.objects.all())
    role = serializers.ChoiceField(choices=User.Role.choices, default=User.Role.FACULTY)
    temporary_password = serializers.CharField(write_only=True)

    def validate_email(self, value):
        validate_institution_email(value)
        if user_email_exists(value):
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def validate_temporary_password(self, value):
        validate_password(value)
        return value

    def validate_employee_id(self, value):
        if FacultyProfile.objects.filter(employee_id=value).exists():
            raise serializers.ValidationError("This employee ID is already in use.")
        return value

    def validate(self, attrs):
        # A brand-new row, so there's no existing profile to exclude from
        # the "does this department already have an HOD" check.
        validate_hod_slot_available(attrs.get("designation"), attrs.get("department"))
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        password = validated_data.pop("temporary_password")
        department = validated_data.pop("department")
        # HOD designation always carries the HOD role, same as everywhere
        # else this mapping applies (see role_for_designation) — the
        # explicit `role` field stays meaningful for the one thing
        # designation *can't* express (IQAC/Super Admin has no designation
        # equivalent), but it can't be used to create a "designation: HOD,
        # role: faculty" mismatch.
        designation = validated_data["designation"]
        role = User.Role.HOD if designation == FacultyProfile.Designation.HOD else validated_data["role"]
        user = User.objects.create_user(
            email=validated_data["email"],
            password=password,
            full_name=validated_data["full_name"],
            role=role,
            department=department,
        )
        profile = FacultyProfile.objects.create(
            user=user,
            department=department,
            full_name=validated_data["full_name"],
            designation=validated_data["designation"],
            employee_id=validated_data["employee_id"],
            contact_number=validated_data.get("contact_number", ""),
            join_date=validated_data.get("join_date"),
        )
        return profile


class TransferHODSerializer(serializers.Serializer):
    """The successor's details for FacultyProfileViewSet.transfer_hod —
    the box Update Details shows when the acting HOD changes her own
    designation away from HOD. Deliberately its own serializer rather
    than reusing FacultyCreateSerializer: department/role aren't
    client-supplied here at all (always the acting HOD's own department,
    always role HOD), and designation is fixed to HOD rather than a free
    choice, since the entire point of this form is naming a successor."""

    title = serializers.ChoiceField(choices=["Dr.", "Mr.", "Mrs.", "Ms."])
    full_name = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    employee_id = serializers.CharField(max_length=30)
    designation = serializers.ChoiceField(choices=FacultyProfile.Designation.choices, default=FacultyProfile.Designation.HOD)
    temporary_password = serializers.CharField(write_only=True)
    join_date = serializers.DateField(required=False, allow_null=True)
    date_of_birth = serializers.DateField(required=False, allow_null=True)

    def validate_designation(self, value):
        if value != FacultyProfile.Designation.HOD:
            raise serializers.ValidationError("The successor must be given the HOD designation.")
        return value

    def validate_email(self, value):
        validate_institution_email(value)
        if user_email_exists(value):
            raise serializers.ValidationError("An account with this email already exists.")
        return value

    def validate_temporary_password(self, value):
        validate_password(value)
        return value

    def validate_employee_id(self, value):
        if FacultyProfile.objects.filter(employee_id=value).exists():
            raise serializers.ValidationError("This employee ID is already in use.")
        return value


class FacultyUpdateSerializer(serializers.ModelSerializer):
    """Backs both the HOD-driven roster edit and a faculty member's own
    'Update Details' — every field here is intentionally editable by the
    owner themselves; email is the only thing that can never change, and it
    isn't part of this serializer at all (it lives on User, not here)."""

    class Meta:
        model = FacultyProfile
        fields = ["full_name", "designation", "department", "gender", "bio", "contact_number", "join_date", "date_of_birth"]

    def validate_date_of_birth(self, value):
        _validate_minimum_age(value)
        return value

    def validate_join_date(self, value):
        _validate_join_date_range(value)
        return value

    def validate(self, attrs):
        # PATCH-friendly: designation/department may not be in attrs at all
        # if this update isn't touching them, so fall back to what's
        # already on the record — exclude_profile_id is this same record,
        # so re-saving your own designation:"hod" unchanged never trips
        # over yourself as a false "second HOD".
        designation = attrs.get("designation", getattr(self.instance, "designation", None))
        department = attrs.get("department", getattr(self.instance, "department", None))
        exclude_id = self.instance.id if self.instance else None
        validate_hod_slot_available(designation, department, exclude_profile_id=exclude_id)
        return attrs


class RegisterSerializer(serializers.Serializer):
    """Public self-registration. `role` is never client-supplied directly —
    nobody can grant themselves IQAC/Super Admin *system permissions*
    through this form — but `designation` does drive it via
    role_for_designation: picking HOD here creates a real HOD-role account
    (department review/verification authority, MFA-required), same as if
    an existing HOD later changed their own designation to HOD in Update
    Details. This is a deliberate choice to keep role tracking designation
    dynamically everywhere rather than needing a separate admin
    confirmation step — see role_for_designation's docstring.
    """

    # Only Employee ID and Date of Birth are mandatory right now — the
    # college is onboarding AI & ML first, so Department is hardcoded to
    # AIML below rather than client-supplied, and Designation/Join Date/
    # Phone Number are all fillable later via "Update Details". Date of
    # Birth doubles as the forgot-password identity check (see
    # PasswordResetRequestView), which is why it can't be made optional too.
    full_name = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    designation = serializers.ChoiceField(choices=FacultyProfile.Designation.choices, required=False, allow_null=True)
    gender = serializers.ChoiceField(choices=FacultyProfile.Gender.choices, required=False, allow_blank=True)
    employee_id = serializers.CharField(max_length=30)
    contact_number = serializers.CharField(max_length=20, required=False, allow_blank=True)
    join_date = serializers.DateField(required=False, allow_null=True)
    date_of_birth = serializers.DateField()

    def validate_email(self, value):
        validate_institution_email(value)
        if user_email_exists(value):
            raise serializers.ValidationError("An account with this email already exists. Please log in instead.")
        return value

    def validate_password(self, value):
        validate_password(value)
        return value

    def validate_designation(self, value):
        # Department is hardcoded to AIML for self-registration (see the
        # class docstring) — every self-registered account lands there, so
        # this checks against that same fixed department rather than a
        # client-supplied one.
        validate_hod_slot_available(value, Department.objects.get(code="AIML"))
        return value

    def validate_employee_id(self, value):
        if FacultyProfile.objects.filter(employee_id=value).exists():
            raise serializers.ValidationError("This employee ID is already in use.")
        return value

    def validate_full_name(self, value):
        # A person registering twice under the exact same name is the
        # specific duplicate-registration case this guards against —
        # different people who happen to share a name should use a
        # distinguishing employee ID instead, which is checked separately.
        # Collapsing internal whitespace (not just trimming the ends)
        # matters here: "Dr. Shiwani   Gupta" (stray double space from a
        # typo) is the same name as "Dr. Shiwani Gupta" to any human
        # reading it, but iexact treats them as different strings and lets
        # a real duplicate slip straight through.
        normalized = re.sub(r"\s+", " ", value).strip()
        if User.objects.filter(full_name__iexact=normalized).exists():
            raise serializers.ValidationError(
                "An account already exists under this exact name. If this is you, please log in instead; "
                "otherwise contact IQAC to resolve the name conflict."
            )
        return normalized

    def validate_date_of_birth(self, value):
        _validate_minimum_age(value)
        return value

    def validate_join_date(self, value):
        _validate_join_date_range(value)
        return value

    @transaction.atomic
    def create(self, validated_data):
        password = validated_data.pop("password")
        # The college is onboarding AI & ML first — every self-registration
        # goes into that department. Once other departments start
        # onboarding, this can become a real field again.
        # Lock the department row so two simultaneous HOD registrations can't
        # both pass the slot check.
        department = Department.objects.select_for_update().get(code="AIML")
        designation = validated_data.get("designation") or FacultyProfile.Designation.ASSISTANT_PROFESSOR
        try:
            validate_hod_slot_available(designation, department)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"designation": exc.messages}) from exc
        user = User.objects.create_user(
            email=validated_data["email"],
            password=password,
            full_name=validated_data["full_name"],
            role=role_for_designation(designation),
            department=department,
        )
        profile = FacultyProfile.objects.create(
            user=user,
            department=department,
            full_name=validated_data["full_name"],
            designation=designation,
            gender=validated_data.get("gender", ""),
            employee_id=validated_data["employee_id"],
            contact_number=validated_data.get("contact_number", ""),
            join_date=validated_data.get("join_date"),
            date_of_birth=validated_data.get("date_of_birth"),
        )
        return profile
