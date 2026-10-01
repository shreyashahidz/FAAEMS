from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.accounts.models import FacultyProfile
from apps.achievements.models import Achievement
from apps.notifications.services import create_notification_once, remind_pending_verifications
from apps.notifications.models import Notification


class Command(BaseCommand):
    """Scheduled scan (Phase 9.4) — intended to run daily via cron/Celery
    Beat on the deployed server. Every run is idempotent: create_notification_once
    skips anything already flagged and unread.
    """

    help = "Scans for expiring certificates and incomplete faculty profiles, and creates notification rows."

    def add_arguments(self, parser):
        parser.add_argument("--expiry-window-days", type=int, default=30)

    def handle(self, *args, **options):
        window_days = options["expiry_window_days"]
        created = 0
        created += self._scan_expiring_certificates(window_days)
        created += self._scan_incomplete_profiles()
        # Resurfaces (bumps, doesn't duplicate) any "awaiting your
        # verification" notice that's gone stale (20h+) while its
        # achievement is still unverified — an HOD who hasn't acted keeps
        # seeing it as a fresh unread item once a day.
        remind_pending_verifications()
        self.stdout.write(self.style.SUCCESS(f"Notification scan complete — {created} new notification(s)."))

    def _scan_expiring_certificates(self, window_days):
        cutoff = timezone.now().date() + timedelta(days=window_days)
        expiring = Achievement.objects.filter(
            expiry_date__isnull=False,
            expiry_date__lte=cutoff,
            expiry_date__gte=timezone.now().date(),
            is_deleted=False,
        ).select_related("faculty__user")

        count = 0
        for achievement in expiring:
            days_left = (achievement.expiry_date - timezone.now().date()).days
            create_notification_once(
                achievement.faculty.user,
                Notification.NotificationType.CERTIFICATE_EXPIRING,
                "Certificate expiring soon",
                f"“{achievement.title}” expires in {days_left} day(s).",
                achievement.evidence_id,
            )
            count += 1
        return count

    def _scan_incomplete_profiles(self):
        # FacultyProfile has no single boolean for "complete" — treat a
        # missing contact number OR join date as incomplete, since those
        # are the fields most likely to matter for institutional records.
        incomplete = FacultyProfile.objects.filter(status=FacultyProfile.Status.ACTIVE).filter(
            models_q_incomplete()
        )

        count = 0
        for profile in incomplete.select_related("user"):
            missing = []
            if not profile.contact_number:
                missing.append("contact number")
            if not profile.join_date:
                missing.append("join date")
            create_notification_once(
                profile.user,
                Notification.NotificationType.INCOMPLETE_PROFILE,
                "Your profile is incomplete",
                f"Missing: {', '.join(missing)}. Please update your profile.",
            )
            count += 1
        return count


def models_q_incomplete():
    from django.db.models import Q

    return Q(contact_number="") | Q(join_date__isnull=True)
