from django.db import models

from apps.common.models import TimeStampedModel


class AccreditationFramework(TimeStampedModel):
    """NBA, NAAC, etc. — data-driven, no hardcoded criterion logic anywhere
    (Phase 5.1)."""

    name = models.CharField(max_length=100, unique=True)
    code = models.CharField(max_length=20, unique=True)
    description = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Cycle(TimeStampedModel):
    """An assessment cycle/version, e.g. 'NAAC 2026 Cycle' or academic year
    '2025-2026'. Old cycles stay intact and queryable independently of new
    ones.

    `created_by` is null for the institution's default/seeded years — those
    stay visible to every faculty member unconditionally. A non-null value
    means the year was created through one faculty's own "+ Add Year"
    (CycleViewSet.add_next) rather than by IQAC/admin, in which case it's
    only visible to faculty who have a FacultyCycleSubscription row for it
    (see that model) — other faculty never see a year they didn't add
    themselves, and removing that subscription only ever affects the
    removing faculty's own dropdown and their own achievements."""

    framework = models.ForeignKey(AccreditationFramework, on_delete=models.PROTECT, related_name="cycles")
    label = models.CharField(max_length=60)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        "accounts.User", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )

    class Meta:
        ordering = ["-start_date", "label"]
        unique_together = [("framework", "label")]

    def __str__(self):
        return f"{self.framework.code} — {self.label}"


class FacultyCycleSubscription(TimeStampedModel):
    """Which faculty-added academic years (see Cycle.created_by) appear in
    one faculty's own submission-wizard Year dropdown. A row here only ever
    exists for years that faculty explicitly added via "+ Add Year" — the
    institution's default/seeded years never get one and so can never be
    removed by an individual faculty member (CycleViewSet.remove_mine)."""

    faculty = models.ForeignKey(
        "accounts.FacultyProfile", on_delete=models.CASCADE, related_name="cycle_subscriptions"
    )
    cycle = models.ForeignKey(Cycle, on_delete=models.CASCADE, related_name="faculty_subscriptions")

    class Meta:
        unique_together = [("faculty", "cycle")]

    def __str__(self):
        return f"{self.faculty} -> {self.cycle.label}"


class Criterion(TimeStampedModel):
    framework = models.ForeignKey(AccreditationFramework, on_delete=models.PROTECT, related_name="criteria")
    code = models.CharField(max_length=20)  # e.g. "6"
    title = models.CharField(max_length=255)  # e.g. "Faculty Contributions"
    max_marks = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["code"]
        unique_together = [("framework", "code")]

    def __str__(self):
        return f"{self.code} — {self.title}"


class SubCriterion(TimeStampedModel):
    """A node in the criteria tree, e.g. 6.1 / 6.1.2 / 6.1.2.1. `description`
    is the full descriptive text shown in every dropdown — the UI never
    shows a bare code or a marks/percentage scale (Appendix A.1 display
    rule, tightened further to also hide raw codes and mark tiers entirely).

    `parent` makes this a self-referencing tree instead of one flat level:
    the achievement wizard walks it generically (does the selected node
    have children? render another dropdown; no children? it's a leaf,
    submission proceeds) — so an admin can add/remove/re-nest sub-points
    at any depth from the admin UI with no frontend code change.
    """

    criterion = models.ForeignKey(Criterion, on_delete=models.PROTECT, related_name="sub_criteria")
    parent = models.ForeignKey("self", null=True, blank=True, on_delete=models.CASCADE, related_name="children")
    code = models.CharField(max_length=20)  # internal id only, e.g. "6.1.4" — never rendered to faculty
    description = models.TextField()
    order = models.PositiveIntegerField(default=0)
    max_marks = models.PositiveIntegerField(default=0)  # internal/report use only — never shown in the UI
    evidence_required_note = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["order", "code"]
        unique_together = [("criterion", "code")]

    def __str__(self):
        return f"{self.code} — {self.description[:60]}"


class RequiredEvidenceTarget(TimeStampedModel):
    """department + sub-criterion + cycle + required count, used for the
    completeness score (Phase 6)."""

    department = models.ForeignKey("accounts.Department", on_delete=models.CASCADE, related_name="evidence_targets")
    sub_criterion = models.ForeignKey(SubCriterion, on_delete=models.CASCADE, related_name="targets")
    cycle = models.ForeignKey(Cycle, on_delete=models.CASCADE, related_name="targets")
    required_count = models.PositiveIntegerField(default=1)

    class Meta:
        unique_together = [("department", "sub_criterion", "cycle")]

    def __str__(self):
        return f"{self.department.code}/{self.sub_criterion.code}/{self.cycle.label} → {self.required_count}"


class AchievementCategory(TimeStampedModel):
    """The faculty-facing category shown in Achievement Category dropdown
    (Appendix A.1 step 3), e.g. 'Certification', 'STTP/FDP Training'. Scoped
    per framework/cycle and mapped to one or more sub-criteria via
    ActivityTypeToCriterionMapping — adding a new category is an admin-UI
    row, not a frontend deploy."""

    name = models.CharField(max_length=120)
    description = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "achievement categories"

    def __str__(self):
        return self.name


class ActivityTypeToCriterionMapping(TimeStampedModel):
    category = models.ForeignKey(AchievementCategory, on_delete=models.CASCADE, related_name="criterion_mappings")
    sub_criterion = models.ForeignKey(SubCriterion, on_delete=models.CASCADE, related_name="category_mappings")
    framework = models.ForeignKey(AccreditationFramework, on_delete=models.CASCADE, related_name="+")
    cycle = models.ForeignKey(Cycle, on_delete=models.CASCADE, related_name="+", null=True, blank=True)

    class Meta:
        unique_together = [("category", "sub_criterion", "cycle")]

    def __str__(self):
        return f"{self.category.name} → {self.sub_criterion.code}"
