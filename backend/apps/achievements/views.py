import os
import re

from django.contrib.postgres.search import SearchQuery, SearchVector
from django.db import transaction
from django.http import FileResponse, Http404
from django.utils import timezone
from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from apps.accounts.models import FacultyProfile, User
from apps.accounts.permissions import can_access_achievement, can_manage_non_active_faculty_record, is_achievement_owner
from apps.achievements.models import Achievement, EvidenceDocument, EvidenceIntegrityAlert
from apps.achievements.serializers import AchievementSerializer, EvidenceDocumentSerializer
from apps.audit.models import AuditLog
from apps.notifications.services import (
    notify_achievement_removed,
    notify_evidence_added,
    notify_evidence_removed,
    notify_missing_evidence,
)


def _write_audit(actor, action_name, achievement, old_status, new_status, remarks=""):
    AuditLog.objects.create(
        actor=actor,
        action=action_name,
        target_evidence_id=achievement.evidence_id,
        target_type="Achievement",
        old_value={"status": old_status},
        new_value={"status": new_status},
        remarks=remarks,
    )


class AchievementViewSet(viewsets.ModelViewSet):
    serializer_class = AchievementSerializer
    filterset_fields = ["status", "faculty", "category", "cycle"]

    def get_queryset(self):
        user = self.request.user
        qs = Achievement.objects.select_related("faculty", "category", "cycle").prefetch_related("documents")
        if user.role in {User.Role.IQAC_ADMIN, User.Role.SUPER_ADMIN}:
            pass  # unrestricted, but still falls through to the search filter below
        elif user.role == User.Role.HOD:
            qs = qs.filter(faculty__department_id=user.department_id)
        else:
            qs = qs.filter(faculty__user=user)

        query = self.request.query_params.get("search")
        if query:
            # Real Postgres full-text search (Phase 8.1/8.2) — covers the
            # achievement's own fields *and* OCR-extracted evidence text,
            # not just a client-side filter over already-fetched rows.
            vector = SearchVector("title", "description", "issuing_organization", "documents__ocr_text")
            qs = qs.annotate(search=vector).filter(search=SearchQuery(query))
        return qs

    def get_object(self):
        obj = super().get_object()
        # Belt-and-braces IDOR check even though get_queryset already scopes
        # this — object-level lookups by id must never leak another
        # faculty's record (Phase 12.4/12.5).
        if not can_access_achievement(self.request.user, obj):
            raise PermissionDenied("You do not have access to this record.")
        return obj

    def perform_create(self, serializer):
        user = self.request.user
        faculty = serializer.validated_data.get("faculty")
        if user.role not in {User.Role.IQAC_ADMIN, User.Role.SUPER_ADMIN}:
            own_profile = getattr(user, "faculty_profile", None)
            if not own_profile or faculty.id != own_profile.id:
                raise PermissionDenied("You can only submit achievements under your own faculty profile.")
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        """Achievement is a SoftDeleteModel, but ModelViewSet's default
        destroy() calls instance.delete() — Django's real hard delete —
        since SoftDeleteModel doesn't override delete() itself. Left alone,
        a DELETE call here would violate Phase 2.6's 'no hard deletes on
        accreditation evidence' rule outright, so this always only ever
        soft-deletes. A faculty member can remove their own submission at
        any point, including one HOD has already verified — only an
        IQAC_LOCKED record is truly final. notify_achievement_removed
        tells both the faculty and their reviewer either way, so deleting
        an already-verified record is never silent. Only the submitting
        faculty member can do this — get_object()'s can_access_achievement
        check is deliberately broader (it also lets a reviewing HOD/IQAC
        fetch the record), so delete needs its own, narrower check here.
        The one exception is can_manage_non_active_faculty_record: once
        the submitting faculty member is non-active and can no longer log
        in to clean up their own dossier, their department's HOD (or
        IQAC/Super Admin) can delete a stray record on their behalf —
        never for a currently-active faculty member."""
        instance = self.get_object()
        if not (
            is_achievement_owner(request.user, instance)
            or can_manage_non_active_faculty_record(request.user, instance.faculty)
        ):
            raise PermissionDenied("Only the submitting faculty member can delete this record.")
        if instance.status == Achievement.Status.IQAC_LOCKED:
            raise ValidationError(
                {"detail": "This record has been locked in by IQAC as the institutional record. Ask IQAC to unlock it first."}
            )
        instance.soft_delete(by_user=request.user, reason="Removed by faculty.")
        notify_achievement_removed(instance)
        return Response(status=204)

    @action(detail=False, methods=["get"], url_path="data-quality")
    def data_quality(self, request):
        """Data completeness/hygiene, distinct from accreditation
        completeness (Phase 8.5) — helps IQAC/HOD clean the dataset
        regardless of whether NBA/NAAC targets are met. Every number is a
        live DB aggregate over the caller's own scoped queryset."""
        if request.user.role not in {User.Role.HOD, User.Role.IQAC_ADMIN, User.Role.SUPER_ADMIN}:
            raise PermissionDenied("Not authorized to view data quality metrics.")

        qs = self.get_queryset()
        documents = EvidenceDocument.objects.filter(achievement__in=qs)

        return Response(
            {
                "missing_achievement_date": qs.filter(achievement_date__isnull=True).count(),
                "missing_issuing_organization": qs.filter(issuing_organization="").count(),
                "duplicate_documents": documents.exclude(duplicate_of__isnull=True).count(),
                "low_ocr_confidence_documents": documents.filter(
                    ocr_confidence__isnull=False, ocr_confidence__lt=50
                ).count(),
                "unverified_documents": documents.filter(
                    verification_status=EvidenceDocument.VerificationStatus.PENDING
                ).count(),
                "open_integrity_alerts": EvidenceIntegrityAlert.objects.filter(
                    document__in=documents, resolved=False
                ).count(),
            }
        )

    def perform_update(self, serializer):
        # Editing is the submitting faculty member's own action, same as
        # add/delete — a reviewer's access (can_access_achievement, used by
        # get_object()) is read-and-verify only.
        instance = serializer.instance
        if not is_achievement_owner(self.request.user, instance):
            raise PermissionDenied("Only the submitting faculty member can edit this record.")
        if instance.status == Achievement.Status.IQAC_LOCKED:
            raise ValidationError({"detail": "This record is IQAC-locked and can no longer be edited directly."})
        serializer.save()

    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        """Draft → Verified. There is no HOD verification step: a submission
        is accepted as soon as the faculty member submits it, and the HOD (or
        IQAC) can only view and download the attachments. "Verified" is kept
        as the stored status so the leaderboard, reports and the rest of the
        pipeline keep counting accepted records without any change.
        """
        achievement = self.get_object()
        if achievement.status not in {Achievement.Status.DRAFT, Achievement.Status.CORRECTIONS_REQUIRED}:
            raise ValidationError({"detail": f"Cannot submit from status '{achievement.status}'."})
        with transaction.atomic():
            old = achievement.status
            achievement.submitted_at = timezone.now()
            achievement.status = Achievement.Status.VERIFIED
            achievement.verified_at = timezone.now()
            achievement.verified_by = request.user
            achievement.save(update_fields=["status", "submitted_at", "verified_at", "verified_by"])
            achievement.documents.update(verification_status=EvidenceDocument.VerificationStatus.VERIFIED)
            _write_audit(request.user, "submit", achievement, old, achievement.status)
        if not achievement.documents.exists():
            notify_missing_evidence(achievement)
        return Response(AchievementSerializer(achievement, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="iqac/lock", permission_classes=[permissions.IsAuthenticated])
    def iqac_lock(self, request, pk=None):
        achievement = self.get_object()
        if request.user.role not in {User.Role.IQAC_ADMIN, User.Role.SUPER_ADMIN}:
            raise PermissionDenied("Only IQAC can lock a record.")
        if achievement.status != Achievement.Status.VERIFIED:
            raise ValidationError({"detail": "Only verified records can be IQAC-locked."})
        with transaction.atomic():
            old = achievement.status
            achievement.status = Achievement.Status.IQAC_LOCKED
            achievement.locked_at = timezone.now()
            achievement.locked_by = request.user
            achievement.save(update_fields=["status", "locked_at", "locked_by"])
            _write_audit(request.user, "iqac_lock", achievement, old, achievement.status)
        return Response(AchievementSerializer(achievement, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="iqac/unlock")
    def iqac_unlock(self, request, pk=None):
        """IQAC unlocks (remarks required) → new document version branched
        by a subsequent upload → HOD re-verifies → IQAC re-locks. Never
        overwrites an old version (Phase 3.5)."""
        achievement = self.get_object()
        if request.user.role not in {User.Role.IQAC_ADMIN, User.Role.SUPER_ADMIN}:
            raise PermissionDenied("Only IQAC can unlock a record.")
        remarks = self._require_remarks(request)
        if achievement.status != Achievement.Status.IQAC_LOCKED:
            raise ValidationError({"detail": "Only IQAC-locked records can be unlocked."})
        with transaction.atomic():
            old = achievement.status
            achievement.status = Achievement.Status.CORRECTIONS_REQUIRED
            achievement.remarks = remarks
            achievement.locked_at = None
            achievement.locked_by = None
            achievement.save(update_fields=["status", "remarks", "locked_at", "locked_by"])
            _write_audit(request.user, "iqac_unlock", achievement, old, achievement.status, remarks)
        return Response(AchievementSerializer(achievement, context={"request": request}).data)


class EvidenceDocumentViewSet(viewsets.ModelViewSet):
    http_method_names = ["get", "post", "delete", "head", "options"]
    serializer_class = EvidenceDocumentSerializer

    def get_queryset(self):
        user = self.request.user
        qs = EvidenceDocument.objects.select_related("achievement__faculty")
        if user.role in {User.Role.IQAC_ADMIN, User.Role.SUPER_ADMIN}:
            return qs
        if user.role == User.Role.HOD:
            return qs.filter(achievement__faculty__department_id=user.department_id)
        return qs.filter(achievement__faculty__user=user)

    def perform_create(self, serializer):
        # Adding evidence is the submitting faculty member's own action —
        # a reviewing HOD/IQAC can view and verify, but not edit someone
        # else's dossier, so this is deliberately narrower than
        # can_access_achievement (which also grants reviewers read access).
        achievement = serializer.validated_data["achievement"]
        if not is_achievement_owner(self.request.user, achievement):
            raise PermissionDenied("Only the submitting faculty member can add evidence to this record.")
        if achievement.status == Achievement.Status.IQAC_LOCKED:
            raise ValidationError({"detail": "This record is IQAC-locked; ask IQAC to unlock it first."})
        document = serializer.save()
        notify_evidence_added(document)

    def destroy(self, request, *args, **kwargs):
        """Lets a faculty member remove their own attachment at any point,
        including one HOD has already verified — only IQAC_LOCKED is
        truly final. Same narrower ownership check as perform_create:
        a reviewer can view and verify but never delete someone else's
        evidence — except can_manage_non_active_faculty_record, the same
        one-at-a-time override AchievementViewSet.destroy() allows once
        the uploader is non-active. notify_evidence_removed tells both
        sides either way."""
        doc = self.get_object()
        if not (
            is_achievement_owner(request.user, doc.achievement)
            or can_manage_non_active_faculty_record(request.user, doc.achievement.faculty)
        ):
            raise PermissionDenied("Only the submitting faculty member can delete this attachment.")
        if doc.achievement.status == Achievement.Status.IQAC_LOCKED:
            raise ValidationError(
                {"detail": "This record has been locked in by IQAC. Ask IQAC to unlock it first."}
            )
        achievement = doc.achievement
        doc.soft_delete(by_user=request.user, reason="Removed by uploader.")
        if achievement.documents.exists():
            notify_evidence_removed(achievement)
        else:
            # That was the last attachment — an empty submission is just
            # clutter, and removing it automatically means deleting a
            # single-attachment record is one click, not two ("delete the
            # file" then separately "now delete the now-empty submission").
            achievement.soft_delete(by_user=request.user, reason="Last attachment removed.")
            notify_achievement_removed(achievement)
        return Response(status=204)

    @action(detail=True, methods=["get"])
    def download(self, request, pk=None):
        """Streams the evidence file through Django rather than handing out
        a direct MinIO URL — MinIO stays unreachable from outside the Docker
        network in production (Phase 14), so this proxy is the only way a
        browser ever sees the bytes, and it re-checks the same IDOR rule as
        everywhere else rather than trusting the queryset scoping alone."""
        doc = self.get_object()
        if not can_access_achievement(request.user, doc.achievement):
            raise PermissionDenied("You do not have access to this document.")
        try:
            file_handle = doc.file.open("rb")
        except FileNotFoundError as exc:
            raise Http404("Evidence file not found in storage.") from exc
        # Strip the "v{n}_" version prefix evidence_upload_path adds — the
        # frontend always overrides this with the clean name anyway, but
        # this header is what a browser falls back to for a bare link.
        filename = re.sub(r"^v\d+_", "", doc.file.name.rsplit("/", 1)[-1])
        response = FileResponse(file_handle, content_type=doc.content_type or "application/octet-stream")
        response["Content-Disposition"] = f'inline; filename="{filename}"'
        return response

    @action(detail=True, methods=["get"])
    def preview(self, request, pk=None):
        """The converted-to-PDF stand-in for a Word/PowerPoint/Excel file
        (see _run_preview_conversion_in_background) — same access check and
        streaming-proxy rationale as download() above, just a different
        underlying file. 404 covers both "not that kind of file" and
        "conversion hasn't finished/failed yet"; the serializer's
        preview_url is already null in both cases, so a client hitting
        this directly without checking that first gets a clean 404 either
        way rather than a confusing empty response."""
        doc = self.get_object()
        if not can_access_achievement(request.user, doc.achievement):
            raise PermissionDenied("You do not have access to this document.")
        if doc.preview_status != EvidenceDocument.PreviewStatus.READY or not doc.preview_file:
            raise Http404("No preview available for this document.")
        try:
            file_handle = doc.preview_file.open("rb")
        except FileNotFoundError as exc:
            raise Http404("Preview file not found in storage.") from exc
        original_name = re.sub(r"^v\d+_", "", doc.file.name.rsplit("/", 1)[-1])
        preview_name = f"{os.path.splitext(original_name)[0]}.pdf"
        response = FileResponse(file_handle, content_type="application/pdf")
        response["Content-Disposition"] = f'inline; filename="{preview_name}"'
        return response
