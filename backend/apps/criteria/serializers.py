from rest_framework import serializers

from apps.criteria.models import (
    AccreditationFramework,
    AchievementCategory,
    Criterion,
    Cycle,
    SubCriterion,
)


class AccreditationFrameworkSerializer(serializers.ModelSerializer):
    class Meta:
        model = AccreditationFramework
        fields = ["id", "name", "code", "description", "is_active"]


class CycleSerializer(serializers.ModelSerializer):
    # True only for a year the requesting faculty added themselves (has a
    # FacultyCycleSubscription row) — the institution's default/seeded
    # years are never individually removable, see Cycle.created_by.
    can_remove = serializers.SerializerMethodField()

    class Meta:
        model = Cycle
        fields = ["id", "framework", "label", "start_date", "end_date", "is_active", "can_remove"]

    def get_can_remove(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        faculty = getattr(request.user, "faculty_profile", None)
        if faculty is None:
            return False
        return obj.faculty_subscriptions.filter(faculty=faculty).exists()


class CriterionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Criterion
        fields = ["id", "framework", "code", "title", "max_marks"]


class SubCriterionSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubCriterion
        fields = ["id", "criterion", "parent", "code", "description", "evidence_required_note"]


class AchievementCategorySerializer(serializers.ModelSerializer):
    """The label shown in Achievement Category dropdown is always the full
    descriptive text of the sub-criterion it maps to (Appendix A.1 display
    rule) — sub_criteria is resolved from ActivityTypeToCriterionMapping,
    never hardcoded on the frontend."""

    sub_criteria = serializers.SerializerMethodField()

    class Meta:
        model = AchievementCategory
        fields = ["id", "name", "description", "is_active", "sub_criteria"]

    def get_sub_criteria(self, obj):
        # Step 3 picks the category (which best-fits one specific
        # sub-criterion, e.g. Certification -> 6.1.4); Step 5 ("Sub-Point")
        # then lets the faculty pick precisely within that whole criterion
        # family (all of 6.1.x), per Appendix A.1's own example. So we
        # resolve the mapped sub-criteria's parent criterion/criteria and
        # return every sub-criterion under them.
        mapped = obj.criterion_mappings.select_related("sub_criterion__criterion").all()
        criterion_ids = {m.sub_criterion.criterion_id for m in mapped}
        if not criterion_ids:
            return []
        qs = SubCriterion.objects.filter(criterion_id__in=criterion_ids).order_by("code")
        return SubCriterionSerializer(qs, many=True).data
