from rest_framework.routers import DefaultRouter

from apps.criteria.views import (
    AccreditationFrameworkViewSet,
    AchievementCategoryViewSet,
    CriterionViewSet,
    CycleViewSet,
    SubCriterionViewSet,
)

router = DefaultRouter()
router.register("frameworks", AccreditationFrameworkViewSet, basename="framework")
router.register("cycles", CycleViewSet, basename="cycle")
router.register("criteria", CriterionViewSet, basename="criterion")
router.register("sub-criteria", SubCriterionViewSet, basename="sub-criterion")
router.register("achievement-categories", AchievementCategoryViewSet, basename="achievement-category")

urlpatterns = router.urls
