from rest_framework.routers import DefaultRouter

from apps.reports.views import ReportSnapshotViewSet, ReportTemplateViewSet

router = DefaultRouter()
router.register("report-templates", ReportTemplateViewSet, basename="report-template")
router.register("reports", ReportSnapshotViewSet, basename="report-snapshot")

urlpatterns = router.urls
