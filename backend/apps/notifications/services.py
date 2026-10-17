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


def notify_missing_evidence(achievement):
    """Intentionally silent: a faculty member's only attachment-related
    notification is the one built at login (notify_missing_attachments_on_login)."""


def notify_evidence_added(document):
    """Intentionally silent — nobody (faculty or HOD) is notified when an
    attachment is added or updated. The HOD simply sees it in the dossier."""


def notify_evidence_removed(achievement):
    """No new notice for anyone; only drops any stale unread notice that
    still points at this record."""
    Notification.objects.filter(
        related_evidence_id=achievement.evidence_id,
        is_read=False,
    ).exclude(notification_type=Notification.NotificationType.SUBMISSION_DELETED).delete()


def notify_achievement_removed(achievement):
    """The achievement itself is gone, so any still-unread notice pointing
    at it is stale. The HOD is told (once) that the submission was
    deleted; the faculty member who deleted it gets no confirmation."""
    Notification.objects.filter(related_evidence_id=achievement.evidence_id, is_read=False).delete()
    for recipient in _reviewer_recipients(achievement):
        create_notification_once(
            recipient,
            Notification.NotificationType.SUBMISSION_DELETED,
            "A submission was deleted",
            f"{achievement.faculty.full_name} deleted their submission “{achievement.title}”.",
            achievement.evidence_id,
        )


def notify_missing_attachments_on_login(user):
    """The single notification a faculty member gets: each time they log in,
    a fresh list of the criteria where one of their submissions has no
    attachment. Replaces the previous unread one (so a login after a logout
    never stacks duplicates) and creates nothing when nothing is missing."""
    from django.db.models import Exists, OuterRef

    from apps.achievements.models import Achievement, EvidenceDocument

    Notification.objects.filter(
        recipient=user, notification_type=Notification.NotificationType.MISSING_EVIDENCE, is_read=False
    ).delete()

    profile = getattr(user, "faculty_profile", None)
    if profile is None:
        return

    has_document = EvidenceDocument.objects.filter(achievement=OuterRef("pk"))
    achievements = (
        Achievement.objects.filter(faculty=profile)
        .exclude(status=Achievement.Status.DRAFT)
        .annotate(has_doc=Exists(has_document))
        .filter(has_doc=False)
        .prefetch_related("criterion_mappings__sub_criterion__parent__parent__parent")
    )

    labels = []
    for achievement in achievements:
        label = achievement.title
        mapping = achievement.criterion_mappings.first()
        if mapping:
            node = mapping.sub_criterion
            while node.parent_id and node.max_marks == 0:
                node = node.parent
            label = node.description
        if label not in labels:
            labels.append(label)

    if not labels:
        return
    Notification.objects.create(
        recipient=user,
        notification_type=Notification.NotificationType.MISSING_EVIDENCE,
        title="Attachments missing",
        message="You have not attached a document for: " + "; ".join(labels) + ".",
        related_evidence_id="",
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
            f"{snapshot.framework.name} / {snapshot.cycle.label}: {len(snapshot.evidence_ids)} records.",
        )
