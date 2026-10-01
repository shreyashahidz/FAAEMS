"""File security constraints (Phase 2.5): allowed types checked by actual
content (magic bytes, and for container formats what's actually inside the
container), not just the extension or client-sent MIME type, plus a max
size cap — enforced before anything reaches MinIO.
"""

import hashlib
import zipfile

from django.conf import settings
from django.core.exceptions import ValidationError

_DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
_PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
_XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
_DOC_MIME = "application/msword"
_PPT_MIME = "application/vnd.ms-powerpoint"
_XLS_MIME = "application/vnd.ms-excel"
_CSV_MIME = "text/csv"

_SIGNATURES = {
    "application/pdf": (b"%PDF-",),
    "image/jpeg": (b"\xff\xd8\xff",),
    "image/png": (b"\x89PNG\r\n\x1a\n",),
}

# Modern .docx/.pptx/.xlsx are actually ZIP archives (Office Open XML) — the
# ZIP magic bytes alone can't tell one from a plain .zip, so this also has
# to peek at which well-known internal path each format always has, using
# zipfile rather than trusting the extension.
_ZIP_SIGNATURES = (b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08")
_OOXML_MARKERS = {
    "word/document.xml": _DOCX_MIME,
    "ppt/presentation.xml": _PPTX_MIME,
    "xl/workbook.xml": _XLSX_MIME,
}

# Legacy .doc/.ppt/.xls (pre-2007 binary format) all share the same
# Compound File Binary (OLE2) container signature — indistinguishable from
# the first bytes alone. Telling them apart means opening the compound
# file's own internal directory and checking which named stream it has.
_OLE2_SIGNATURE = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"
_OLE2_STREAM_MARKERS = {
    "WordDocument": _DOC_MIME,
    "PowerPoint Document": _PPT_MIME,
    "Workbook": _XLS_MIME,
    "Book": _XLS_MIME,
}


def _sniff_ooxml(file_obj) -> str | None:
    try:
        with zipfile.ZipFile(file_obj) as zf:
            names = set(zf.namelist())
    except zipfile.BadZipFile:
        return None
    finally:
        file_obj.seek(0)
    for marker, mime in _OOXML_MARKERS.items():
        if marker in names:
            return mime
    return None


def _sniff_ole2(file_obj) -> str | None:
    import olefile

    try:
        with olefile.OleFileIO(file_obj) as ole:
            streams = {"/".join(entry) for entry in ole.listdir()}
    except (OSError, ValueError):
        return None
    finally:
        file_obj.seek(0)
    for marker, mime in _OLE2_STREAM_MARKERS.items():
        if any(marker in stream for stream in streams):
            return mime
    return None


def _sniff_csv(file_obj) -> str | None:
    """CSV is plain text — unlike every other accepted format, it has no
    magic bytes at all, so "is this actually a CSV" can only ever be a
    heuristic: decode a sample as text (reject anything with a NUL byte,
    the one cheap, reliable binary/text signal) and confirm csv.Sniffer
    can find a consistent delimiter across multiple lines, rather than
    accepting any random text file just because it isn't one of the known
    binary formats."""
    import csv

    file_obj.seek(0)
    sample_bytes = file_obj.read(8192)
    file_obj.seek(0)

    if b"\x00" in sample_bytes:
        return None
    try:
        sample_text = sample_bytes.decode("utf-8-sig")
    except UnicodeDecodeError:
        return None

    lines = [line for line in sample_text.splitlines() if line.strip()]
    if len(lines) < 1:
        return None
    try:
        csv.Sniffer().sniff(sample_text, delimiters=",;\t")
    except csv.Error:
        return None
    return _CSV_MIME


def sniff_content_type(file_obj) -> str | None:
    file_obj.seek(0)
    header = file_obj.read(16)
    file_obj.seek(0)

    for content_type, signatures in _SIGNATURES.items():
        if any(header.startswith(sig) for sig in signatures):
            return content_type

    if any(header.startswith(sig) for sig in _ZIP_SIGNATURES):
        return _sniff_ooxml(file_obj)

    if header.startswith(_OLE2_SIGNATURE):
        return _sniff_ole2(file_obj)

    return _sniff_csv(file_obj)


def validate_evidence_file(file_obj):
    max_bytes = settings.MAX_EVIDENCE_FILE_SIZE_MB * 1024 * 1024
    if file_obj.size > max_bytes:
        raise ValidationError(f"File exceeds the {settings.MAX_EVIDENCE_FILE_SIZE_MB}MB limit.")

    detected = sniff_content_type(file_obj)
    if detected is None or detected not in settings.ALLOWED_EVIDENCE_CONTENT_TYPES:
        raise ValidationError(
            "Only PDF, Word (.doc/.docx), PowerPoint (.ppt/.pptx), Excel (.xls/.xlsx), CSV, JPG, and PNG "
            "files are accepted (checked by file content, not extension)."
        )
    return detected


def hash_file(file_obj) -> str:
    file_obj.seek(0)
    hasher = hashlib.sha256()
    for chunk in iter(lambda: file_obj.read(8192), b""):
        hasher.update(chunk)
    file_obj.seek(0)
    return hasher.hexdigest()
