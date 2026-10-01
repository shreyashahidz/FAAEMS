from django.db import models

from apps.common.models import TimeStampedModel


class ReportTemplate(TimeStampedModel):
    """Template-driven, not hardcoded per criterion (Phase 7.1) — the
    generator always walks the live Criterion/SubCriterion hierarchy from
    the DB; this row just carries formatting/versioning metadata so a
    snapshot can record exactly which template version produced it."""

    framework = models.ForeignKey("criteria.AccreditationFramework", on_delete=models.PROTECT, related_name="report_templates")
    name = models.CharField(max_length=150)
    version = models.CharField(max_length=20, default="1.0")
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["-created_at"]
        unique_together = [("framework", "name", "version")]

    def __str__(self):
        return f"{self.name} v{self.version} ({self.framework.code})"


def report_upload_path(instance, filename):
    return f"reports/{instance.framework.code}/{instance.cycle.label}/{instance.id or 'new'}_{filename}"


class ReportSnapshot(TimeStampedModel):
    """A frozen record of one generated report (Phase 7.4): who generated
    it, from which template version, exactly which Evidence IDs it
    includes, and a checksum so the export can later be proven unchanged
    and reproduced."""

    class Format(models.TextChoices):
        DOCX = "docx", "DOCX"

    framework = models.ForeignKey("criteria.AccreditationFramework", on_delete=models.PROTECT, related_name="+")
    cycle = models.ForeignKey("criteria.Cycle", on_delete=models.PROTECT, related_name="report_snapshots")
    template = models.ForeignKey(ReportTemplate, null=True, blank=True, on_delete=models.SET_NULL, related_name="snapshots")
    template_version = models.CharField(max_length=20, blank=True, default="")

    generated_by = models.ForeignKey("accounts.User", on_delete=models.PROTECT, related_name="+")
    file_format = models.CharField(max_length=10, choices=Format.choices, default=Format.DOCX)
    file = models.FileField(upload_to=report_upload_path, max_length=500)
    checksum = models.CharField(max_length=64)  # SHA-256 of the generated file bytes
    evidence_ids = models.JSONField(default=list)  # human-readable Evidence IDs included, not raw PKs

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.framework.code}/{self.cycle.label} report @ {self.created_at:%Y-%m-%d %H:%M}"
