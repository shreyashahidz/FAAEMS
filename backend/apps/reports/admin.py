from django.contrib import admin

from apps.reports.models import ReportSnapshot, ReportTemplate

admin.site.register(ReportTemplate)


@admin.register(ReportSnapshot)
class ReportSnapshotAdmin(admin.ModelAdmin):
    list_display = ["framework", "cycle", "generated_by", "checksum", "created_at"]
    readonly_fields = [f.name for f in ReportSnapshot._meta.fields]

    def has_add_permission(self, request):
        return False
