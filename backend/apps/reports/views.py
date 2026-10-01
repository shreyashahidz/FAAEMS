from django.core.files.base import ContentFile
from django.http import FileResponse, Http404
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from apps.accounts.permissions import IsIQACAdminOrAbove
from apps.notifications.services import notify_report_generated
from apps.reports.generator import checksum_of, generate_report_docx
from apps.reports.models import ReportSnapshot, ReportTemplate
from apps.reports.serializers import GenerateReportSerializer, ReportSnapshotSerializer, ReportTemplateSerializer


class ReportTemplateViewSet(viewsets.ModelViewSet):
    queryset = ReportTemplate.objects.select_related("framework").all()
    serializer_class = ReportTemplateSerializer
    permission_classes = [IsIQACAdminOrAbove]


class ReportSnapshotViewSet(viewsets.ReadOnlyModelViewSet):
    """Reports aggregate cross-faculty, cross-department evidence, so
    generating/viewing them is IQAC/super-admin only — a department HOD
    reviews her own department, but the institutional accreditation report
    is an IQAC-level artifact."""

    queryset = ReportSnapshot.objects.select_related("framework", "cycle", "generated_by").all()
    serializer_class = ReportSnapshotSerializer
    permission_classes = [IsIQACAdminOrAbove]
    filterset_fields = ["framework", "cycle"]

    @action(detail=False, methods=["post"])
    def generate(self, request):
        serializer = GenerateReportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        framework = serializer.validated_data["framework"]
        cycle = serializer.validated_data["cycle"]
        template = serializer.validated_data.get("template")

        file_bytes, evidence_ids = generate_report_docx(framework, cycle)
        checksum = checksum_of(file_bytes)

        snapshot = ReportSnapshot(
            framework=framework,
            cycle=cycle,
            template=template,
            template_version=template.version if template else "adhoc",
            generated_by=request.user,
            checksum=checksum,
            evidence_ids=evidence_ids,
        )
        filename = f"{framework.code}_{cycle.label}_{timezone.now():%Y%m%d%H%M%S}.docx".replace(" ", "_")
        snapshot.file.save(filename, ContentFile(file_bytes), save=False)
        snapshot.save()
        notify_report_generated(snapshot)

        return Response(ReportSnapshotSerializer(snapshot, context={"request": request}).data, status=201)

    @action(detail=True, methods=["get"])
    def download(self, request, pk=None):
        snapshot = self.get_object()
        try:
            file_handle = snapshot.file.open("rb")
        except FileNotFoundError as exc:
            raise Http404("Report file not found in storage.") from exc
        filename = snapshot.file.name.rsplit("/", 1)[-1]
        response = FileResponse(
            file_handle,
            content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response

    @action(detail=True, methods=["get"])
    def verify(self, request, pk=None):
        """Re-fetches the stored file from MinIO, recomputes its checksum,
        and confirms it still matches what was recorded at generation time
        (Phase 7's 'can later be proven unchanged' requirement) — this is a
        real integrity check, not a trust-the-database assumption."""
        snapshot = self.get_object()
        try:
            with snapshot.file.open("rb") as f:
                actual_checksum = checksum_of(f.read())
        except FileNotFoundError:
            return Response({"matches": False, "detail": "Report file missing from storage."}, status=200)
        return Response(
            {
                "matches": actual_checksum == snapshot.checksum,
                "recorded_checksum": snapshot.checksum,
                "actual_checksum": actual_checksum,
            }
        )
