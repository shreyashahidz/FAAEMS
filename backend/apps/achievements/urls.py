from rest_framework.routers import DefaultRouter

from apps.achievements.views import AchievementViewSet, EvidenceDocumentViewSet

router = DefaultRouter()
router.register("achievements", AchievementViewSet, basename="achievement")
router.register("evidence-documents", EvidenceDocumentViewSet, basename="evidence-document")

urlpatterns = router.urls
