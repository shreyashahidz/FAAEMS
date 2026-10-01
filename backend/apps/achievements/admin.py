from django.contrib import admin

from apps.achievements.models import Achievement, EvidenceDocument, EvidenceIntegrityAlert, EvidenceMapping


@admin.register(Achievement)
class AchievementAdmin(admin.ModelAdmin):
    list_display = ["evidence_id", "title", "faculty", "category", "status", "created_at"]
    list_filter = ["status", "category"]
    search_fields = ["evidence_id", "title"]


admin.site.register(EvidenceDocument)
admin.site.register(EvidenceMapping)


@admin.register(EvidenceIntegrityAlert)
class EvidenceIntegrityAlertAdmin(admin.ModelAdmin):
    list_display = ["document", "resolved", "detail", "created_at"]
    list_filter = ["resolved"]
