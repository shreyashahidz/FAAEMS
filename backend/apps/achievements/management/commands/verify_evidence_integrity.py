"""Postgres↔MinIO integrity job (Phase 13.6).

Re-hashes the actual object in MinIO for every EvidenceDocument and compares
it to the SHA-256 recorded in Postgres at upload time. A mismatch means
silent corruption or storage drift — the DB row and the object have come
apart — which a simple "does the file exist" check would never catch.
Intended to run on a schedule (cron/Celery Beat) on the deployed server;
every run is safe to re-run and auto-resolves alerts that are no longer
reproducing (e.g. after a restore).
"""

import hashlib
import logging

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.achievements.models import EvidenceDocument, EvidenceIntegrityAlert

logger = logging.getLogger("faems")


class Command(BaseCommand):
    help = "Re-hashes every evidence file in MinIO and compares it against the hash recorded in Postgres."

    def handle(self, *args, **options):
        documents = EvidenceDocument.all_objects.all()
        checked = 0
        mismatches = 0
        missing = 0

        for doc in documents:
            checked += 1
            try:
                with doc.file.open("rb") as f:
                    actual_hash = hashlib.sha256(f.read()).hexdigest()
            except FileNotFoundError:
                missing += 1
                EvidenceIntegrityAlert.objects.get_or_create(
                    document=doc,
                    resolved=False,
                    defaults={
                        "expected_hash": doc.file_hash,
                        "actual_hash": "",
                        "detail": "Object missing from MinIO entirely.",
                    },
                )
                logger.critical(
                    "Evidence integrity failure: object missing for %s (doc id %s)",
                    doc.achievement.evidence_id,
                    doc.id,
                )
                continue

            if actual_hash != doc.file_hash:
                mismatches += 1
                EvidenceIntegrityAlert.objects.get_or_create(
                    document=doc,
                    resolved=False,
                    defaults={
                        "expected_hash": doc.file_hash,
                        "actual_hash": actual_hash,
                        "detail": "Stored object hash does not match the hash recorded at upload time.",
                    },
                )
                logger.critical(
                    "Evidence integrity failure: hash mismatch for %s (doc id %s) expected=%s actual=%s",
                    doc.achievement.evidence_id,
                    doc.id,
                    doc.file_hash,
                    actual_hash,
                )
            else:
                # No longer reproducing — auto-resolve any open alert (e.g.
                # after a restore fixed it).
                EvidenceIntegrityAlert.objects.filter(document=doc, resolved=False).update(
                    resolved=True, resolved_at=timezone.now()
                )

        self.stdout.write(
            self.style.SUCCESS(
                f"Checked {checked} document(s): {mismatches} hash mismatch(es), {missing} missing object(s)."
            )
        )
