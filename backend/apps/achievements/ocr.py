"""Best-effort OCR (Phase 4). Extracts text + a confidence score from an
uploaded certificate, and tries to guess a few metadata fields (date,
issuing organization) to pre-fill the submission form.

This must NEVER block a submission: every call is wrapped so a failure
(missing binary, corrupt file, unreadable scan) degrades to "no text
extracted" rather than raising — Phase 4.4's hard requirement.
"""

import logging
import re

logger = logging.getLogger("faems")

KNOWN_ORGANIZATIONS = [
    "SWAYAM", "NPTEL", "Coursera", "edX", "Udemy", "AWS", "Google", "Microsoft",
    "IEEE", "ACM", "Infosys", "TCS", "IBM", "NVIDIA", "Cisco", "Oracle",
]

DATE_PATTERNS = [
    r"\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b",
    r"\b(\d{4}-\d{2}-\d{2})\b",
    r"\b(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})\b",
]


def _ocr_image(image, timeout: int = 8) -> tuple[str, float]:
    import pytesseract

    # No timeout here means a slow/complex scan (or a Tesseract process
    # that just gets stuck) can block the whole upload request forever —
    # the surrounding try/except in extract_text_and_confidence only
    # catches exceptions, not slowness, so the bound has to be enforced
    # here. pytesseract raises RuntimeError on timeout, which that catch
    # already treats as "OCR degraded, continue without it."
    data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT, timeout=timeout)
    words = [w for w in data["text"] if w.strip()]
    confidences = [int(c) for c, w in zip(data["conf"], data["text"]) if w.strip() and int(c) >= 0]
    text = " ".join(words)
    avg_confidence = (sum(confidences) / len(confidences)) if confidences else 0.0
    return text, round(avg_confidence, 1)


def extract_text_and_confidence(file_obj, content_type: str) -> tuple[str, float | None]:
    """Returns (text, confidence_0_to_100). confidence is None if OCR
    wasn't attempted at all (e.g. unsupported type) rather than 0, so the
    caller can tell "low confidence" apart from "never tried"."""
    try:
        file_obj.seek(0)
        if content_type in {"image/jpeg", "image/png"}:
            from PIL import Image

            image = Image.open(file_obj)
            text, confidence = _ocr_image(image)
            return text, confidence

        if content_type == "application/pdf":
            from pdf2image import convert_from_bytes

            pages = convert_from_bytes(file_obj.read(), first_page=1, last_page=2, dpi=200)
            texts, confs = [], []
            for page in pages:
                t, c = _ocr_image(page)
                if t:
                    texts.append(t)
                    confs.append(c)
            if not texts:
                return "", None
            return "\n".join(texts), round(sum(confs) / len(confs), 1)

        return "", None
    except Exception as exc:  # noqa: BLE001 — OCR must degrade, never block (Phase 4.4)
        logger.warning("OCR extraction failed, continuing without it: %s", exc)
        return "", None
    finally:
        file_obj.seek(0)


def guess_fields(text: str) -> dict:
    """Cheap heuristic extraction — the faculty always confirms/edits these
    before save (Phase 4.3), so false positives here are cheap."""
    if not text:
        return {}

    fields = {}
    for org in KNOWN_ORGANIZATIONS:
        if re.search(rf"\b{re.escape(org)}\b", text, re.IGNORECASE):
            fields["issuing_organization"] = org
            break

    for pattern in DATE_PATTERNS:
        match = re.search(pattern, text)
        if match:
            fields["date_guess"] = match.group(1)
            break

    return fields
