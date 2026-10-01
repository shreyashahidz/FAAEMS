from django.contrib import admin

from apps.criteria.models import (
    AccreditationFramework,
    AchievementCategory,
    ActivityTypeToCriterionMapping,
    Criterion,
    Cycle,
    RequiredEvidenceTarget,
    SubCriterion,
)

admin.site.register(AccreditationFramework)
admin.site.register(Cycle)
admin.site.register(Criterion)
admin.site.register(SubCriterion)
admin.site.register(AchievementCategory)
admin.site.register(ActivityTypeToCriterionMapping)
admin.site.register(RequiredEvidenceTarget)
