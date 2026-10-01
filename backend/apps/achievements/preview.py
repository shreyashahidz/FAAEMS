"""Preview generation for evidence files a browser can't render natively
(Word/PowerPoint/Excel) — converts to PDF via headless LibreOffice so
"View" can actually show something instead of just downloading. Same
best-effort, never-blocks-the-request spirit as ocr.py: this only ever
runs in a background thread after the upload response is already sent.
"""

import logging
import os
import subprocess
import tempfile

logger = logging.getLogger("faems")

# LibreOffice picks its output format from the input file's extension, not
# its content — has to match one it actually opens (Writer for doc/docx,
# Impress for ppt/pptx, Calc for xls/xlsx).
_EXTENSION_BY_CONTENT_TYPE = {
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/vnd.ms-powerpoint": ".ppt",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
    "application/vnd.ms-excel": ".xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
}

CONVERTIBLE_CONTENT_TYPES = frozenset(_EXTENSION_BY_CONTENT_TYPE)


def convert_to_pdf(file_bytes: bytes, content_type: str, timeout: int = 90) -> bytes | None:
    """Returns PDF bytes, or None if this content type isn't convertible or
    the conversion failed (soffice missing/timed out/rejected the file) —
    callers treat None as "couldn't generate a preview," never as a reason
    to fail the upload itself."""
    extension = _EXTENSION_BY_CONTENT_TYPE.get(content_type)
    if extension is None:
        return None

    with tempfile.TemporaryDirectory() as tmpdir:
        input_path = os.path.join(tmpdir, f"input{extension}")
        with open(input_path, "wb") as f:
            f.write(file_bytes)

        # -env:UserInstallation gives this invocation its own scratch
        # profile dir — without it, concurrent soffice processes (this
        # runs under 3 gunicorn workers) fight over the same default
        # profile lock and one of them fails with "already running".
        profile_dir = os.path.join(tmpdir, "lo_profile")
        try:
            subprocess.run(
                [
                    "soffice",
                    "--headless",
                    "--norestore",
                    f"-env:UserInstallation=file://{profile_dir}",
                    "--convert-to",
                    "pdf",
                    "--outdir",
                    tmpdir,
                    input_path,
                ],
                capture_output=True,
                timeout=timeout,
                check=True,
            )
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired, FileNotFoundError) as exc:
            logger.warning("LibreOffice preview conversion failed: %s", exc)
            return None

        output_path = os.path.join(tmpdir, "input.pdf")
        if not os.path.exists(output_path):
            logger.warning("LibreOffice reported success but produced no output file")
            return None
        with open(output_path, "rb") as f:
            return f.read()
