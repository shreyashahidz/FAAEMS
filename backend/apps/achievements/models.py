from django.db import models

from apps.common.models import SoftDeleteModel, TimeStampedModel


class EvidenceIdSequence(models.Model):
    """Backing counter for the human-readable Evidence ID (dept code + year +
    sequence). Not exposed via the API directly."""

    department_code = models.CharField(max_length=20)
    year = models.PositiveIntegerField()
    last_value = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = [("department_code", "year")]


class Achievement(SoftDeleteModel, TimeStampedModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        SUBMITTED = "submitted", "Submitted"
        HOD_REVIEW = "hod_review", "HOD Review"
        CORRECTIONS_REQUIRED = "corrections_required", "Corrections Required"
        RESUBMITTED = "resubmitted", "Resubmitted"
        VERIFIED = "verified", "Verified"
        IQAC_LOCKED = "iqac_locked", "IQAC Locked"
        REJECTED = "rejected", "Rejected"

    evidence_id = models.CharField(max_length=40, unique=True, editable=False)
    faculty = models.ForeignKey(
        "accounts.FacultyProfile", on_delete=models.PROTECT, related_name="achievements"
    )
    # Optional / legacy: the achievement wizard now drives everything off
    # the SubCriterion tree directly (via EvidenceMapping) rather than a
    # separate flat category picklist, so this is no longer required on
    # create. Left nullable rather than removed so existing rows/reports
    # that do have a category keep working.
    category = models.ForeignKey(
        "criteria.AchievementCategory", null=True, blank=True, on_delete=models.PROTECT, related_name="achievements"
    )
    cycle = models.ForeignKey("criteria.Cycle", on_delete=models.PROTECT, related_name="achievements")

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    issuing_organization = models.CharField(max_length=255, blank=True, default="")
    achievement_date = models.DateField(null=True, blank=True)
    issue_date = models.DateField(null=True, blank=True)
    expiry_date = models.DateField(null=True, blank=True)

    status = models.CharField(max_length=30, choices=Status.choices, default=Status.DRAFT)
    submitted_at = models.DateTimeField(null=True, blank=True)
    verified_at = models.DateTimeField(null=True, blank=True)
    verified_by = models.ForeignKey(
        "accounts.User", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    locked_at = models.DateTimeField(null=True, blank=True)
    locked_by = models.ForeignKey(
        "accounts.User", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    remarks = models.TextField(
        blank=True, default="", help_text="Mandatory whenever status becomes rejected/corrections_required/unlocked."
    )

    created_by = models.ForeignKey("accounts.User", on_delete=models.PROTECT, related_name="+")

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["faculty"]),
            models.Index(fields=["category"]),
            models.Index(fields=["achievement_date"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return f"{self.evidence_id}: {self.title}"

    def save(self, *args, **kwargs):
        if not self.evidence_id:
            from apps.achievements.evidence_id import generate_evidence_id

            year = (self.achievement_date or self.created_at).year if self.achievement_date else None
            if year is None:
                from django.utils import timezone

                year = timezone.now().year
            self.evidence_id = generate_evidence_id(self.faculty.department.code, year)
        super().save(*args, **kwargs)


def evidence_upload_path(instance, filename):
    faculty = instance.achievement.faculty
    return (
        f"{faculty.department.code}/{faculty.employee_id}/"
        f"{instance.achievement.evidence_id}/v{instance.version_number}_{filename}"
    )


def evidence_preview_upload_path(instance, filename):
    faculty = instance.achievement.faculty
    return (
        f"{faculty.department.code}/{faculty.employee_id}/"
        f"{instance.achievement.evidence_id}/previews/v{instance.version_number}_preview.pdf"
    )


class EvidenceDocument(SoftDeleteModel, TimeStampedModel):
    class VerificationStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        VERIFIED = "verified", "Verified"
        REJECTED = "rejected", "Rejected"

    achievement = models.ForeignKey(Achievement, on_delete=models.PROTECT, related_name="documents")
    file = models.FileField(upload_to=evidence_upload_path, max_length=500)
    object_key = models.CharField(max_length=500, blank=True, default="")
    file_hash = models.CharField(max_length=64, db_index=True)  # SHA-256
    file_size = models.PositiveIntegerField(default=0)
    content_type = models.CharField(max_length=100, blank=True, default="")

    version_number = models.PositiveIntegerField(default=1)
    previous_version = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.SET_NULL, related_name="next_versions"
    )
    reason_for_modification = models.CharField(max_length=255, blank=True, default="")

    uploaded_by = models.ForeignKey("accounts.User", on_delete=models.PROTECT, related_name="+")
    verification_status = models.CharField(
        max_length=20, choices=VerificationStatus.choices, default=VerificationStatus.PENDING
    )

    # --- OCR (Phase 4) — never a blocker; null/blank means "not extracted" ---
    ocr_text = models.TextField(blank=True, default="")
    ocr_confidence = models.FloatField(null=True, blank=True)
    ocr_extracted_fields = models.JSONField(default=dict, blank=True)

    # --- Preview PDF (Word/PowerPoint/Excel have no browser-native
    # renderer, so "View" on one converts it to PDF via headless
    # LibreOffice in the background, same async-after-upload pattern as
    # OCR). pending/ready/failed/not_applicable (PDF/JPG/PNG already
    # render natively and never need this). ---
    class PreviewStatus(models.TextChoices):
        NOT_APPLICABLE = "not_applicable", "Not Applicable"
        PENDING = "pending", "Pending"
        READY = "ready", "Ready"
        FAILED = "failed", "Failed"

    preview_file = models.FileField(upload_to=evidence_preview_upload_path, max_length=500, blank=True, null=True)
    preview_status = models.CharField(
        max_length=20, choices=PreviewStatus.choices, default=PreviewStatus.NOT_APPLICABLE
    )

    # --- Duplicate detection surfacing ---
    duplicate_of = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.SET_NULL, related_name="duplicates"
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["file_hash"]),
            models.Index(fields=["achievement"]),
        ]

    def __str__(self):
        return f"{self.achievement.evidence_id} v{self.version_number}"


class EvidenceMapping(TimeStampedModel):
    """One achievement/evidence can map to multiple sub-criteria across
    frameworks/cycles — this join table is where criterion linkage lives,
    never a direct FK on Achievement/EvidenceDocument (Phase 2.7)."""

    achievement = models.ForeignKey(Achievement, on_delete=models.CASCADE, related_name="criterion_mappings")
    sub_criterion = models.ForeignKey(
        "criteria.SubCriterion", on_delete=models.PROTECT, related_name="evidence_mappings"
    )
    framework = models.ForeignKey("criteria.AccreditationFramework", on_delete=models.PROTECT, related_name="+")
    cycle = models.ForeignKey("criteria.Cycle", on_delete=models.PROTECT, related_name="+")

    class Meta:
        unique_together = [("achievement", "sub_criterion", "cycle")]
        indexes = [
            models.Index(fields=["sub_criterion", "cycle"]),
            models.Index(fields=["framework", "cycle"]),
        ]

    def __str__(self):
        return f"{self.achievement.evidence_id} → {self.sub_criterion.code}"


class EvidenceIntegrityAlert(TimeStampedModel):
    """Raised by the periodic Postgres↔MinIO integrity job (Phase 13.6) when
    the object actually stored in MinIO no longer hashes to what Postgres
    recorded at upload time — silent corruption or storage drift, not a
    normal application error. Surfaced on the Data Quality dashboard."""

    document = models.ForeignKey(EvidenceDocument, on_delete=models.CASCADE, related_name="integrity_alerts")
    expected_hash = models.CharField(max_length=64)
    actual_hash = models.CharField(max_length=64, blank=True, default="")
    detail = models.CharField(max_length=255)
    resolved = models.BooleanField(default=False)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Integrity alert on {self.document.achievement.evidence_id}"
