from django.db import models


class Notification(models.Model):
    class NotificationType(models.TextChoices):
        PENDING_VERIFICATION = "pending_verification", "Pending Verification"
        EVIDENCE_ADDED = "evidence_added", "Evidence Added"
        MISSING_EVIDENCE = "missing_evidence", "Missing Evidence"
        CORRECTIONS_REQUESTED = "corrections_requested", "Corrections Requested"
        CERTIFICATE_EXPIRING = "certificate_expiring", "Certificate Expiring"
        INCOMPLETE_PROFILE = "incomplete_profile", "Incomplete Profile"
        ACHIEVEMENT_VERIFIED = "achievement_verified", "Achievement Verified"
        REPORT_GENERATED = "report_generated", "Report Generated"
        ATTACHMENT_DELETED = "attachment_deleted", "Attachment Deleted"
        SUBMISSION_DELETED = "submission_deleted", "Submission Deleted"
        FACULTY_REGISTRATION_PENDING = "faculty_registration_pending", "Faculty Registration Pending"

    recipient = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="notifications")
    notification_type = models.CharField(max_length=30, choices=NotificationType.choices)
    title = models.CharField(max_length=200)
    message = models.CharField(max_length=500)
    related_evidence_id = models.CharField(max_length=40, blank=True, default="")
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["recipient", "is_read"]),
            models.Index(fields=["notification_type", "related_evidence_id"]),
        ]

    def __str__(self):
        return f"{self.notification_type} → {self.recipient_id}: {self.title}"
