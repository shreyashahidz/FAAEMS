import logging
import os
import re
import threading

from django.core.files.base import ContentFile
from django.db import transaction
from rest_framework import serializers

from apps.achievements.file_validation import hash_file, validate_evidence_file
from apps.achievements.models import Achievement, EvidenceDocument, EvidenceMapping
from apps.achievements.ocr import extract_text_and_confidence, guess_fields
from apps.achievements.preview import CONVERTIBLE_CONTENT_TYPES, convert_to_pdf
from apps.criteria.models import SubCriterion

logger = logging.getLogger("faems")


def _run_ocr_in_background(document_id):
    """OCR is best-effort and, per Phase 4.4, must never block a submission
    — but running it inline still made every upload wait on it, and a
    Tesseract subprocess's own startup cost dominates the timing even for
    a trivially small file, so a 3-4 file submission visibly stacked that
    delay up. This runs after the request/response cycle instead (see
    transaction.on_commit below), re-reading the file from durable storage
    rather than the transient upload temp file, which may already be
    cleaned up by the time a background thread gets to run."""
    from django.db import connection

    try:
        doc = EvidenceDocument.objects.get(id=document_id)
        with doc.file.open("rb") as f:
            ocr_text, ocr_confidence = extract_text_and_confidence(f, doc.content_type)
        doc.ocr_text = ocr_text
        doc.ocr_confidence = ocr_confidence
        doc.ocr_extracted_fields = guess_fields(ocr_text)
        doc.save(update_fields=["ocr_text", "ocr_confidence", "ocr_extracted_fields"])
    except Exception as exc:  # noqa: BLE001 — background best-effort, never re-raise
        logger.warning("Background OCR failed for document %s: %s", document_id, exc)
    finally:
        connection.close()


def _run_preview_conversion_in_background(document_id):
    """Word/PowerPoint/Excel have no browser-native renderer — "View" on
    one of those can't preview anything without a converted PDF to show
    instead. Runs after the response for the same reason OCR does
    (LibreOffice's own startup cost, ~2-5s, would otherwise tax every
    matching upload) and re-reads from durable storage for the same
    reason too."""
    from django.db import connection

    try:
        doc = EvidenceDocument.objects.get(id=document_id)
        with doc.file.open("rb") as f:
            pdf_bytes = convert_to_pdf(f.read(), doc.content_type)
        if pdf_bytes is None:
            doc.preview_status = EvidenceDocument.PreviewStatus.FAILED
            doc.save(update_fields=["preview_status"])
            return
        doc.preview_file.save("preview.pdf", ContentFile(pdf_bytes), save=False)
        doc.preview_status = EvidenceDocument.PreviewStatus.READY
        doc.save(update_fields=["preview_file", "preview_status"])
    except Exception as exc:  # noqa: BLE001 — background best-effort, never re-raise
        logger.warning("Background preview conversion failed for document %s: %s", document_id, exc)
        try:
            EvidenceDocument.objects.filter(id=document_id).update(
                preview_status=EvidenceDocument.PreviewStatus.FAILED
            )
        except Exception:  # noqa: BLE001
            pass
    finally:
        connection.close()


class EvidenceDocumentSerializer(serializers.ModelSerializer):
    is_likely_duplicate = serializers.SerializerMethodField()
    download_url = serializers.SerializerMethodField()
    preview_url = serializers.SerializerMethodField()
    filename = serializers.SerializerMethodField()
    file = serializers.FileField(write_only=True)

    class Meta:
        model = EvidenceDocument
        fields = [
            "id",
            "achievement",
            "file",
            "download_url",
            "preview_url",
            "preview_status",
            "filename",
            "file_hash",
            "file_size",
            "content_type",
            "version_number",
            "reason_for_modification",
            "verification_status",
            "ocr_text",
            "ocr_confidence",
            "ocr_extracted_fields",
            "duplicate_of",
            "is_likely_duplicate",
            "created_at",
        ]
        read_only_fields = [
            "file_hash",
            "file_size",
            "content_type",
            "verification_status",
            "ocr_text",
            "ocr_confidence",
            "ocr_extracted_fields",
            "duplicate_of",
            "preview_status",
        ]

    def get_is_likely_duplicate(self, obj):
        return obj.duplicate_of_id is not None or EvidenceDocument.objects.filter(file_hash=obj.file_hash).exclude(id=obj.id).exists()

    def get_download_url(self, obj):
        # Never the raw MinIO URL (Phase 14: MinIO isn't reachable from
        # outside the Docker network) — always the authenticated proxy.
        request = self.context.get("request")
        path = f"/api/evidence-documents/{obj.id}/download/"
        return request.build_absolute_uri(path) if request else path

    def get_preview_url(self, obj):
        if obj.preview_status != EvidenceDocument.PreviewStatus.READY:
            return None
        request = self.context.get("request")
        path = f"/api/evidence-documents/{obj.id}/preview/"
        return request.build_absolute_uri(path) if request else path

    def get_filename(self, obj):
        # evidence_upload_path stores "v{version}_{original filename}" —
        # strip that prefix and the directory path so the UI can show the
        # name the faculty member actually uploaded, not "Attachment 1".
        base = os.path.basename(obj.file.name)
        return re.sub(r"^v\d+_", "", base)

    def validate_file(self, file_obj):
        detected_type = validate_evidence_file(file_obj)
        self._detected_type = detected_type
        return file_obj

    @transaction.atomic
    def create(self, validated_data):
        file_obj = validated_data["file"]
        content_type = getattr(self, "_detected_type", None) or validate_evidence_file(file_obj)
        file_hash = hash_file(file_obj)

        achievement = validated_data["achievement"]
        previous = achievement.documents.order_by("-version_number").first()
        version_number = (previous.version_number + 1) if previous else 1

        # Duplicate detection (Phase 4.1): flag, never block.
        duplicate = EvidenceDocument.all_objects.filter(file_hash=file_hash).exclude(achievement=achievement).first()

        doc = EvidenceDocument.objects.create(
            achievement=achievement,
            file=file_obj,
            file_hash=file_hash,
            file_size=file_obj.size,
            content_type=content_type,
            version_number=version_number,
            previous_version=previous,
            reason_for_modification=validated_data.get("reason_for_modification", ""),
            uploaded_by=self.context["request"].user,
            duplicate_of=duplicate,
            preview_status=(
                EvidenceDocument.PreviewStatus.PENDING
                if content_type in CONVERTIBLE_CONTENT_TYPES
                else EvidenceDocument.PreviewStatus.NOT_APPLICABLE
            ),
        )
        doc.object_key = doc.file.name
        doc.save(update_fields=["object_key"])

        # OCR (Phase 4.2-4.4) and, for Word/PowerPoint/Excel, PDF preview
        # conversion: both best-effort, neither blocks submission — see
        # _run_ocr_in_background / _run_preview_conversion_in_background.
        # on_commit so the background threads never race this transaction
        # (they look the document up by id, which only exists once this
        # commits).
        transaction.on_commit(lambda: threading.Thread(target=_run_ocr_in_background, args=(doc.id,), daemon=True).start())
        if content_type in CONVERTIBLE_CONTENT_TYPES:
            transaction.on_commit(
                lambda: threading.Thread(target=_run_preview_conversion_in_background, args=(doc.id,), daemon=True).start()
            )
        return doc


class AchievementSerializer(serializers.ModelSerializer):
    faculty_name = serializers.CharField(source="faculty.full_name", read_only=True)
    department = serializers.CharField(source="faculty.department.code", read_only=True)
    category_name = serializers.SerializerMethodField()
    cycle_label = serializers.CharField(source="cycle.label", read_only=True)
    documents = EvidenceDocumentSerializer(many=True, read_only=True)
    criterion_path = serializers.SerializerMethodField()
    sub_criterion = serializers.PrimaryKeyRelatedField(
        queryset=SubCriterion.objects.all(), write_only=True, required=False
    )

    class Meta:
        model = Achievement
        fields = [
            "id",
            "evidence_id",
            "faculty",
            "faculty_name",
            "department",
            "category",
            "category_name",
            "cycle",
            "cycle_label",
            "sub_criterion",
            "criterion_path",
            "title",
            "description",
            "issuing_organization",
            "achievement_date",
            "issue_date",
            "expiry_date",
            "status",
            "remarks",
            "documents",
            "created_at",
        ]
        read_only_fields = ["evidence_id", "status", "remarks"]

    def get_category_name(self, obj):
        return obj.category.name if obj.category_id else None

    def get_criterion_path(self, obj):
        # Human-readable breadcrumb of full descriptive text (never codes)
        # from the mapped sub-criterion up to its top-level parent, e.g.
        # ["Research and Development Activities", "Academic Research",
        # "Number of Publications"] — shown instead of any raw code.
        mapping = obj.criterion_mappings.select_related("sub_criterion").first()
        if not mapping:
            return []
        path = []
        node = mapping.sub_criterion
        while node is not None:
            path.append(node.description)
            node = node.parent
        return list(reversed(path))

    @transaction.atomic
    def create(self, validated_data):
        sub_criterion = validated_data.pop("sub_criterion", None)
        request = self.context["request"]
        achievement = Achievement.objects.create(created_by=request.user, **validated_data)
        if sub_criterion:
            EvidenceMapping.objects.get_or_create(
                achievement=achievement,
                sub_criterion=sub_criterion,
                framework=sub_criterion.criterion.framework,
                cycle=achievement.cycle,
            )
        return achievement
