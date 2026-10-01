from django.contrib import admin

from apps.assistant.models import AssistantQueryLog


@admin.register(AssistantQueryLog)
class AssistantQueryLogAdmin(admin.ModelAdmin):
    list_display = ["user", "question", "matched_intent", "created_at"]
    readonly_fields = [f.name for f in AssistantQueryLog._meta.fields]

    def has_add_permission(self, request):
        return False
