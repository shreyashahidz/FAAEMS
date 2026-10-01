from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("django-admin/", admin.site.urls),  # not exposed publicly in prod (Phase 12.5 — kept behind auth/network)
    path("api/", include("apps.accounts.urls")),
    path("api/", include("apps.criteria.urls")),
    path("api/", include("apps.achievements.urls")),
    path("api/", include("apps.reports.urls")),
    path("api/", include("apps.notifications.urls")),
    path("api/", include("apps.assistant.urls")),
    path("api/health/", include("apps.common.health_urls")),
]
