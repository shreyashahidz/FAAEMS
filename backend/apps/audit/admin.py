from django.contrib import admin

from apps.audit.models import AuditLog, SecurityAuditLog


@admin.register(SecurityAuditLog)
class SecurityAuditLogAdmin(admin.ModelAdmin):
    list_display = ["event_type", "email_attempted", "ip_address", "created_at"]
    list_filter = ["event_type"]
    search_fields = ["email_attempted", "ip_address"]
    readonly_fields = [f.name for f in SecurityAuditLog._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ["action", "target_evidence_id", "actor", "created_at"]
    list_filter = ["action"]
    search_fields = ["target_evidence_id"]
    readonly_fields = [f.name for f in AuditLog._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
