"""
Adapter: PDF files on disk.

Validation, storage and text extraction — the only place the application knows
that a CV is a file, or that pypdf exists.

Files land under CV_STORAGE_DIR/<user-id>/. The directory is keyed on the user's
UUID rather than their username, so nothing a user can type ever steers a path.
These PDFs hold personal data and are never served; only their text is read.
"""

import os
import uuid
from datetime import datetime, timezone

from pypdf import PdfReader

from app.config import settings
from app.errors import InvalidCV

PDF_MAGIC = b"%PDF-"

STORAGE_ROOT = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    settings.cv_storage_dir,
)


def validate(contents: bytes) -> None:
    """Reject anything that isn't a usable PDF, by content rather than by name."""
    if not contents:
        raise InvalidCV("The uploaded file is empty.")

    if len(contents) > settings.max_upload_bytes:
        raise InvalidCV(
            f"File is too large ({len(contents) // (1024 * 1024)} MB). "
            f"Maximum is {settings.max_upload_bytes // (1024 * 1024)} MB."
        )

    # Trust the bytes, not the extension or the client-supplied content type.
    if not contents.startswith(PDF_MAGIC):
        raise InvalidCV("That file is not a PDF.")


def extract_text(path: str) -> str:
    try:
        reader = PdfReader(path)
    except Exception as e:
        raise InvalidCV(f"Could not read the PDF: {e}")

    if len(reader.pages) > settings.max_pdf_pages:
        raise InvalidCV(f"PDF has too many pages (max {settings.max_pdf_pages}).")

    text = "\n".join((page.extract_text() or "") for page in reader.pages)

    if not text.strip():
        raise InvalidCV(
            "No text could be extracted. If this is a scanned CV, it needs OCR first."
        )

    return text


def _destination(user_id: uuid.UUID, filename: str) -> str:
    user_dir = os.path.join(STORAGE_ROOT, str(user_id))
    os.makedirs(user_dir, exist_ok=True)

    safe_name = os.path.basename(filename) or "cv.pdf"
    if not safe_name.lower().endswith(".pdf"):
        safe_name += ".pdf"

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    return os.path.join(user_dir, f"{stamp}_{safe_name}")


def store(user_id: uuid.UUID, contents: bytes, filename: str) -> tuple[str, str]:
    """
    Validate, write, and read the text back.

    Returns (stored_path, extracted_text). Raises InvalidCV on anything unusable,
    having left nothing behind.
    """
    validate(contents)

    path = _destination(user_id, filename)
    with open(path, "wb") as f:
        f.write(contents)

    try:
        text = extract_text(path)
    except InvalidCV:
        # Don't keep a file we can't read anything out of.
        os.remove(path)
        raise

    return path, text
