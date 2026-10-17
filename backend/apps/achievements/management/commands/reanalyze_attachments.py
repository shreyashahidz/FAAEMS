from django.core.management.base import BaseCommand

from apps.achievements.analysis import ANALYSIS_VERSION, analyze_document
from apps.achievements.models import EvidenceDocument
from apps.achievements.ocr import extract_text_and_confidence, guess_fields


class Command(BaseCommand):
    """Re-reads attachments with the current extraction logic: first the text
    (OCR / direct read, only when it is missing unless --all), then the
    structured analysis the NBA report is built from. Files are never
    modified - only the derived `ocr_text`, `ocr_confidence` and
    `ocr_extracted_fields` are rewritten. Identical files (same hash) are
    only read / analysed once per run."""

    help = "Re-extract text and re-analyze attachments with missing or outdated results."

    def add_arguments(self, parser):
        parser.add_argument("--all", action="store_true", help="Redo every attachment, not just stale ones.")
        parser.add_argument("--no-llm", action="store_true", help="Rule-based only (instant, less detail).")

    def handle(self, *args, **options):
        text_cache, done = {}, 0
        for doc in EvidenceDocument.objects.select_related("achievement__faculty").order_by("id").iterator():
            stored = (doc.ocr_extracted_fields or {}).get("analysis") or {}
            fresh = stored.get("version") == ANALYSIS_VERSION and bool(doc.ocr_text.strip() or stored.get("additional_details"))
            if not options["all"] and fresh:
                continue
            if options["all"] or not doc.ocr_text.strip():
                key = doc.file_hash or str(doc.id)
                if key not in text_cache:
                    with doc.file.open("rb") as f:
                        text_cache[key] = extract_text_and_confidence(f, doc.content_type)
                text, conf = text_cache[key]
                doc.ocr_text, doc.ocr_confidence = text, conf
                guessed = guess_fields(text)
                doc.ocr_extracted_fields = {**guessed, **{k: v for k, v in (doc.ocr_extracted_fields or {}).items() if k == "analysis"}}
                doc.save(update_fields=["ocr_text", "ocr_confidence", "ocr_extracted_fields"])
            analyze_document(doc, use_llm=not options["no_llm"])
            done += 1
            self.stdout.write(f"doc {doc.id} ({doc.achievement.evidence_id}, {doc.content_type.split('/')[-1][:20]}): {len(doc.ocr_text)} chars", ending="\n")
            self.stdout.flush()
        self.stdout.write(self.style.SUCCESS(f"{done} attachment(s) processed."))
