from rest_framework import serializers

from apps.criteria.models import AccreditationFramework, Cycle
from apps.reports.models import ReportSnapshot, ReportTemplate


class ReportTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReportTemplate
        fields = ["id", "framework", "name", "version", "is_active"]


class ReportSnapshotSerializer(serializers.ModelSerializer):
    framework_name = serializers.CharField(source="framework.name", read_only=True)
    cycle_label = serializers.CharField(source="cycle.label", read_only=True)
    generated_by_name = serializers.CharField(source="generated_by.full_name", read_only=True)
    evidence_count = serializers.SerializerMethodField()
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = ReportSnapshot
        fields = [
            "id",
            "framework",
            "framework_name",
            "cycle",
            "cycle_label",
            "template",
            "template_version",
            "generated_by",
            "generated_by_name",
            "file_format",
            "checksum",
            "evidence_ids",
            "evidence_count",
            "download_url",
            "created_at",
        ]
        read_only_fields = fields

    def get_evidence_count(self, obj):
        return len(obj.evidence_ids or [])

    def get_download_url(self, obj):
        request = self.context.get("request")
        path = f"/api/reports/{obj.id}/download/"
        return request.build_absolute_uri(path) if request else path


class GenerateReportSerializer(serializers.Serializer):
    framework = serializers.PrimaryKeyRelatedField(queryset=AccreditationFramework.objects.all())
    cycle = serializers.PrimaryKeyRelatedField(queryset=Cycle.objects.all())
    template = serializers.PrimaryKeyRelatedField(queryset=ReportTemplate.objects.all(), required=False, allow_null=True)
