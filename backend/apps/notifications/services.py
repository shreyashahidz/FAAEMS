"""Notification triggers (Phase 9.2). Called inline from the views that
cause the underlying event — this is simpler and more reliable for a
single-server deployment than routing everything through a task queue, and
keeps the trigger visibly next to the code that causes it.
"""

from apps.notifications.models import Notification


def create_notification_once(recipient, notification_type, title, message, related_evidence_id=""):
    """Avoid re-notifying about the same still-open thing on every request
    — only create a new row if there isn't already an unread one for this
    exact (recipient, type, evidence id) combination."""
    exists = Notification.objects.filter(
        recipient=recipient,
        notification_type=notification_type,
        related_evidence_id=related_evidence_id,
        is_read=False,
    ).exists()
    if not exists:
        Notification.objects.create(
            recipient=recipient,
            notification_type=notification_type,
            title=title,
            message=message,
            related_evidence_id=related_evidence_id,
        )


def _reviewer_recipients(achievement):
    """Whoever should be told about something happening on this record:
    the department's HOD, or IQAC/Super Admin instead when the achievement
    belongs to an HOD themselves (an HOD isn't their own reviewer)."""
    from apps.accounts.models import User

    department = achievement.faculty.department
    is_hod_self = achievement.faculty.user_id and achievement.faculty.user.role == User.Role.HOD
    if is_hod_self:
        return User.objects.filter(role__in=[User.Role.IQAC_ADMIN, User.Role.SUPER_ADMIN])
    return User.objects.filter(role=User.Role.HOD, department=department)


def notify_pending_verification(achievement):
    # An HOD's own submissions now auto-verify in AchievementViewSet.submit()
    # and never reach this function via that path — _reviewer_recipients'
    # IQAC/super-admin routing for an HOD's own record only matters for one
    # that predates that change (or otherwise ended up SUBMITTED/RESUBMITTED
    # while owned by an HOD).
    for recipient in _reviewer_recipients(achievement):
        create_notification_once(
            recipient,
            Notification.NotificationType.PENDING_VERIFICATION,
            "Achievement awaiting your verification",
            f"{achievement.faculty.full_name} submitted “{achievement.title}” for review.",
            achievement.evidence_id,
        )


def notify_missing_evidence(achievement):
    """Fired alongside notify_pending_verification when a submission has no
    EvidenceDocument attached yet — tells the faculty member to add proof,
    and flags it to whoever would otherwise review it (same recipients as
    the pending-verification notice) so it isn't mistaken for a complete,
    ready-to-verify submission."""
    create_notification_once(
        achievement.faculty.user,
        Notification.NotificationType.MISSING_EVIDENCE,
        "Evidence still needed",
        f"“{achievement.title}” was submitted without any supporting document attached — add evidence so it can be verified against NBA criteria.",
        achievement.evidence_id,
    )

    for recipient in _reviewer_recipients(achievement):
        create_notification_once(
            recipient,
            Notification.NotificationType.MISSING_EVIDENCE,
            "Submission missing evidence",
            f"{achievement.faculty.full_name} submitted “{achievement.title}” with no evidence document attached yet.",
            achievement.evidence_id,
        )


def notify_corrections_requested(achievement):
    create_notification_once(
        achievement.faculty.user,
        Notification.NotificationType.CORRECTIONS_REQUESTED,
        "Corrections requested on your submission",
        f"“{achievement.title}” needs changes: {achievement.remarks}",
        achievement.evidence_id,
    )


def notify_evidence_added(document):
    """Fired every time a new EvidenceDocument is uploaded — confirms it to
    the uploader and, once the record is actually in the review pipeline
    (not still a private draft), flags the reviewer that fresh evidence
    needs their attention, same recipients as notify_pending_verification.
    """
    from apps.achievements.models import Achievement

    achievement = document.achievement
    create_notification_once(
        achievement.faculty.user,
        Notification.NotificationType.EVIDENCE_ADDED,
        "Attachment added",
        f"You added an attachment to “{achievement.title}”.",
        achievement.evidence_id,
    )

    if achievement.status == Achievement.Status.DRAFT:
        return  # not submitted yet — nothing for a reviewer to look at

    for recipient in _reviewer_recipients(achievement):
        create_notification_once(
            recipient,
            Notification.NotificationType.PENDING_VERIFICATION,
            "New attachment awaiting your verification",
            f"{achievement.faculty.full_name} added an attachment to “{achievement.title}” — it needs review.",
            achievement.evidence_id,
        )


def notify_evidence_removed(achievement):
    """The mirror image of notify_evidence_added: a "please verify"/
    "you added an attachment" notice that's still unread but now points at
    evidence that no longer exists is worse than no notice at all — the
    HOD would open it and find nothing to review. Called after an
    EvidenceDocument is deleted; achievement.documents should already
    reflect the deletion (soft-delete excludes it from the default
    manager) by the time this runs."""
    from apps.achievements.models import Achievement

    # The uploader's own "you added an attachment" confirmation is stale
    # the moment that attachment is gone, regardless of how many others
    # remain on the achievement.
    Notification.objects.filter(
        recipient=achievement.faculty.user,
        notification_type=Notification.NotificationType.EVIDENCE_ADDED,
        related_evidence_id=achievement.evidence_id,
        is_read=False,
    ).delete()

    if not achievement.documents.exists():
        # No evidence left at all: an unread "awaiting your verification" for
        # this achievement is now pointing at nothing, so pull it rather than
        # let the reviewer open it to find an empty record.
        Notification.objects.filter(
            notification_type=Notification.NotificationType.PENDING_VERIFICATION,
            related_evidence_id=achievement.evidence_id,
            is_read=False,
        ).delete()

        if achievement.status in {Achievement.Status.SUBMITTED, Achievement.Status.RESUBMITTED}:
            notify_missing_evidence(achievement)

    # Deleting an attachment is always worth an explicit notice to both
    # sides — not just a silent cleanup of stale notices — since the
    # faculty member can now do this on a record their HOD already
    # reviewed, and the HOD has no other way to notice a verified record
    # just lost one of its supporting files.
    create_notification_once(
        achievement.faculty.user,
        Notification.NotificationType.ATTACHMENT_DELETED,
        "Attachment removed",
        f"You removed an attachment from “{achievement.title}”.",
        achievement.evidence_id,
    )
    for recipient in _reviewer_recipients(achievement):
        create_notification_once(
            recipient,
            Notification.NotificationType.ATTACHMENT_DELETED,
            "Attachment removed from a record you review",
            f"{achievement.faculty.full_name} removed an attachment from “{achievement.title}”.",
            achievement.evidence_id,
        )


def notify_achievement_removed(achievement):
    """The achievement itself is gone (soft-deleted), so ANY still-unread
    notice pointing at it — pending verification, missing evidence,
    corrections requested, evidence added — is now stale for everyone it
    went to, not just the uploader. Unlike notify_evidence_removed (which
    only clears things once *all* evidence is gone), this always clears
    everything, since the record it was about no longer exists at all."""
    Notification.objects.filter(
        related_evidence_id=achievement.evidence_id,
        is_read=False,
    ).delete()

    # Explicit notice to both sides that the submission itself is gone —
    # matters most when it had already been reviewed, since the HOD has no
    # other way to learn a record they verified was then deleted.
    create_notification_once(
        achievement.faculty.user,
        Notification.NotificationType.SUBMISSION_DELETED,
        "Submission deleted",
        f"You deleted your submission “{achievement.title}”.",
        achievement.evidence_id,
    )
    for recipient in _reviewer_recipients(achievement):
        create_notification_once(
            recipient,
            Notification.NotificationType.SUBMISSION_DELETED,
            "A submission you review was deleted",
            f"{achievement.faculty.full_name} deleted their submission “{achievement.title}”.",
            achievement.evidence_id,
        )


def remind_pending_verifications():
    """Keeps an unread "awaiting your verification" notice resurfacing
    roughly once a day for as long as the underlying achievement is still
    unverified, instead of letting a single unread row go stale forever —
    create_notification_once already refuses to create a *second* unread
    row for the same (recipient, achievement), so this bumps the existing
    one's timestamp back to "now" rather than spamming duplicates. Cheap
    enough to call opportunistically (see NotificationViewSet) rather than
    needing a real task scheduler."""
    from datetime import timedelta

    from django.utils import timezone

    from apps.achievements.models import Achievement

    cutoff = timezone.now() - timedelta(hours=20)
    still_pending_evidence_ids = Achievement.objects.filter(
        status__in=[Achievement.Status.SUBMITTED, Achievement.Status.RESUBMITTED]
    ).values_list("evidence_id", flat=True)

    Notification.objects.filter(
        notification_type=Notification.NotificationType.PENDING_VERIFICATION,
        is_read=False,
        created_at__lt=cutoff,
        related_evidence_id__in=list(still_pending_evidence_ids),
    ).update(created_at=timezone.now())


def notify_achievement_verified(achievement):
    create_notification_once(
        achievement.faculty.user,
        Notification.NotificationType.ACHIEVEMENT_VERIFIED,
        "Achievement verified",
        f"“{achievement.title}” was verified.",
        achievement.evidence_id,
    )


def notify_faculty_registration_pending(reg_request):
    """A self-registration is awaiting approval — goes to the department's
    HOD (or IQAC/Super Admin, matching _reviewer_recipients' own fallback,
    for the edge case of a department with no HOD yet to approve its own
    first one). create_notification_once keys on (recipient, type,
    related_evidence_id); related_evidence_id is repurposed here to hold
    the request's own id so a second pending request doesn't get silently
    swallowed as "already notified"."""
    from apps.accounts.models import User

    department = reg_request.department
    recipients = User.objects.filter(role=User.Role.HOD, department=department)
    if not recipients.exists():
        recipients = User.objects.filter(role__in=[User.Role.IQAC_ADMIN, User.Role.SUPER_ADMIN])

    full_name = reg_request.payload.get("full_name", reg_request.email)
    for recipient in recipients:
        create_notification_once(
            recipient,
            Notification.NotificationType.FACULTY_REGISTRATION_PENDING,
            "New faculty registration awaiting your approval",
            f"{full_name} ({reg_request.email}) registered and is waiting for your approval before they can log in.",
            f"regreq-{reg_request.id}",
        )


def notify_report_generated(snapshot):
    from apps.accounts.models import User

    for recipient in User.objects.filter(role__in=[User.Role.IQAC_ADMIN, User.Role.SUPER_ADMIN]).exclude(
        id=snapshot.generated_by_id
    ):
        create_notification_once(
            recipient,
            Notification.NotificationType.REPORT_GENERATED,
            "New accreditation report generated",
            f"{snapshot.framework.name} / {snapshot.cycle.label} — {len(snapshot.evidence_ids)} records.",
        )
