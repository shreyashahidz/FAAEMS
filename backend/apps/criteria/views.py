import re

from django.db.models import Q
from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from apps.accounts.models import User
from apps.accounts.permissions import IsIQACAdminOrAbove
from apps.achievements.models import Achievement
from apps.criteria.models import (
    AccreditationFramework,
    AchievementCategory,
    Criterion,
    Cycle,
    FacultyCycleSubscription,
    SubCriterion,
)
from apps.criteria.serializers import (
    AccreditationFrameworkSerializer,
    AchievementCategorySerializer,
    CriterionSerializer,
    CycleSerializer,
    SubCriterionSerializer,
)
from apps.notifications.services import notify_achievement_removed


class AdminManagedViewSet(viewsets.ModelViewSet):
    """The criteria/framework/cycle taxonomy is non-sensitive reference data
    (no faculty PII), so it's publicly readable — the public landing page's
    achievement-submission preview needs it before login. Only IQAC/super
    admin can edit it (Phase 5.2 admin UI)."""

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.AllowAny()]
        return [IsIQACAdminOrAbove()]


class AccreditationFrameworkViewSet(AdminManagedViewSet):
    queryset = AccreditationFramework.objects.all()
    serializer_class = AccreditationFrameworkSerializer


class CycleViewSet(AdminManagedViewSet):
    queryset = Cycle.objects.select_related("framework").all()
    serializer_class = CycleSerializer
    filterset_fields = ["framework", "is_active"]

    def get_permissions(self):
        # AdminManagedViewSet.get_permissions() above is a blanket override
        # (IQAC/admin-only for any non-safe method) that doesn't consult
        # per-action `permission_classes` from @action at all, so add_next/
        # remove_mine need their own carve-out here rather than relying on
        # the decorator.
        if self.action in {"add_next", "remove_mine"}:
            return [permissions.IsAuthenticated()]
        return super().get_permissions()

    def list(self, request, *args, **kwargs):
        from apps.criteria.academic_year import ensure_current_cycle

        ensure_current_cycle()  # a new academic year appears by itself on 1 June
        return super().list(request, *args, **kwargs)

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        # Plain faculty only ever see the institution's default/seeded
        # years (created_by is null) plus whichever faculty-added years
        # they personally added via "+ Add Year" — a year Faculty A adds
        # never appears for Faculty B unless B adds it too. HOD/IQAC/Super
        # Admin and anonymous/public callers (the landing page's
        # achievement-submission preview) keep seeing the full list, same
        # as before this per-faculty scoping existed.
        if user.is_authenticated and user.role == User.Role.FACULTY:
            faculty = getattr(user, "faculty_profile", None)
            if faculty is not None:
                qs = qs.filter(Q(created_by__isnull=True) | Q(faculty_subscriptions__faculty=faculty)).distinct()
        return qs

    @action(detail=False, methods=["post"], url_path="add-next", permission_classes=[permissions.IsAuthenticated])
    def add_next(self, request):
        """The "+ Add Year" option in the submission wizard's Year dropdown
        — deliberately narrower than full Cycle CRUD (IQAC/admin-only,
        above): this only ever creates exactly the single academic year
        immediately after whatever's currently latest *in the requesting
        faculty's own visible set* (get_queryset above), computed
        server-side rather than taken from the request, so it's safe to
        open to any authenticated faculty member without risking
        arbitrary, out-of-order, or multi-year cycles. Reusing an existing
        label (e.g. another faculty already added the same year) just adds
        this faculty's own subscription to that same Cycle row rather than
        creating a duplicate."""
        framework = AccreditationFramework.objects.filter(is_active=True).first()
        if framework is None:
            raise ValidationError({"detail": "No active accreditation framework is configured."})

        faculty = getattr(request.user, "faculty_profile", None)
        if faculty is None:
            raise PermissionDenied("Only faculty accounts can add academic years.")

        visible = self.get_queryset().filter(framework=framework)
        latest = visible.order_by("-label").first()
        next_start_year = 2025
        if latest:
            match = re.match(r"^(\d{4})-(\d{4})$", latest.label)
            if match:
                next_start_year = int(match.group(2))
        next_label = f"{next_start_year}-{next_start_year + 1}"

        cycle, _created = Cycle.objects.get_or_create(
            framework=framework, label=next_label, defaults={"created_by": request.user}
        )
        FacultyCycleSubscription.objects.get_or_create(faculty=faculty, cycle=cycle)
        return Response(CycleSerializer(cycle, context={"request": request}).data, status=201)

    @action(detail=True, methods=["post"], url_path="remove-mine", permission_classes=[permissions.IsAuthenticated])
    def remove_mine(self, request, pk=None):
        """The "Delete Year" counterpart to add_next — removes this year
        from the requesting faculty's own dropdown and soft-deletes their
        own achievements/attachments under it. Never touches the shared
        Cycle row, any other faculty's subscription, or any other
        faculty's data: get_object() below is already scoped by
        get_queryset() to years this faculty can see, and a year without a
        subscription row for them (an institution default/seeded year, or
        one only some other faculty added) 404s or 400s rather than being
        removable at all."""
        faculty = getattr(request.user, "faculty_profile", None)
        if faculty is None:
            raise PermissionDenied("Only faculty accounts can remove academic years.")

        cycle = self.get_object()
        subscription = FacultyCycleSubscription.objects.filter(faculty=faculty, cycle=cycle).first()
        if subscription is None:
            raise ValidationError({"detail": "You can only remove an academic year you added yourself."})

        achievements = Achievement.objects.filter(faculty=faculty, cycle=cycle)
        if achievements.filter(status=Achievement.Status.IQAC_LOCKED).exists():
            raise ValidationError(
                {"detail": "Some of your records for this year have been locked in by IQAC. Ask IQAC to unlock them first."}
            )
        for achievement in achievements:
            achievement.soft_delete(by_user=request.user, reason=f"Academic year {cycle.label} removed by faculty.")
            notify_achievement_removed(achievement)
        subscription.delete()
        return Response(status=204)


class CriterionViewSet(AdminManagedViewSet):
    queryset = Criterion.objects.select_related("framework").all()
    serializer_class = CriterionSerializer
    filterset_fields = ["framework"]


class SubCriterionViewSet(AdminManagedViewSet):
    queryset = SubCriterion.objects.select_related("criterion", "parent").all()
    serializer_class = SubCriterionSerializer
    filterset_fields = ["criterion", "parent"]

    def get_queryset(self):
        qs = super().get_queryset()
        # ?top_level=true — the wizard's very first tree query (Step 3):
        # nodes with no parent. django-filter's exact FK filter can't
        # express "is null", so this is handled explicitly rather than via
        # filterset_fields.
        if self.request.query_params.get("top_level") == "true":
            qs = qs.filter(parent__isnull=True)
        return qs


class AchievementCategoryViewSet(AdminManagedViewSet):
    queryset = AchievementCategory.objects.filter(is_active=True).prefetch_related("criterion_mappings__sub_criterion")
    serializer_class = AchievementCategorySerializer
