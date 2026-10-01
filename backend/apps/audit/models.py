from django.db import models


class SecurityAuditLog(models.Model):
    """Login/session security events (Phase 1.9) — distinct from the
    record-level AuditLog below, which tracks what happened to institutional
    data.
    """

    class EventType(models.TextChoices):
        LOGIN_SUCCESS = "login_success", "Login Success"
        LOGIN_FAILED = "login_failed", "Login Failed"
        LOGOUT = "logout", "Logout"
        PASSWORD_RESET_REQUESTED = "password_reset_requested", "Password Reset Requested"
        PASSWORD_CHANGED = "password_changed", "Password Changed"
        ACCOUNT_LOCKED = "account_locked", "Account Locked"
        MFA_ENABLED = "mfa_enabled", "MFA Enabled"
        MFA_CHALLENGE_FAILED = "mfa_challenge_failed", "MFA Challenge Failed"
        ACCOUNT_REGISTERED = "account_registered", "Account Registered"
        ACCOUNT_DELETED = "account_deleted", "Account Deleted"
        REGISTRATION_REQUESTED = "registration_requested", "Registration Requested"
        REGISTRATION_REJECTED = "registration_rejected", "Registration Rejected"

    user = models.ForeignKey(
        "accounts.User", null=True, blank=True, on_delete=models.SET_NULL, related_name="security_events"
    )
    email_attempted = models.EmailField(blank=True, default="")
    event_type = models.CharField(max_length=40, choices=EventType.choices)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=255, blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["event_type", "created_at"]),
            models.Index(fields=["user", "created_at"]),
        ]

    def __str__(self):
        return f"{self.event_type} @ {self.created_at:%Y-%m-%d %H:%M}"


class AuditLog(models.Model):
    """Record-level audit trail (Phase 3.6): every state transition on an
    Achievement/EvidenceDocument writes a row here, referenced by the
    human-readable Evidence ID rather than a raw DB integer.
    """

    actor = models.ForeignKey(
        "accounts.User", null=True, blank=True, on_delete=models.SET_NULL, related_name="audit_actions"
    )
    action = models.CharField(max_length=60)
    target_evidence_id = models.CharField(max_length=40, db_index=True)
    target_type = models.CharField(max_length=40)
    old_value = models.JSONField(default=dict, blank=True)
    new_value = models.JSONField(default=dict, blank=True)
    remarks = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["target_evidence_id"]),
            models.Index(fields=["action", "created_at"]),
        ]

    def __str__(self):
        return f"{self.action} on {self.target_evidence_id}"
