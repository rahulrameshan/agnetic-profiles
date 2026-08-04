"""
storage.py
----------
Validation and on-disk storage for uploaded CVs.

Files land under CV_STORAGE_DIR/<user-id>/. The directory is keyed on the user's
UUID rather than their username: a UUID path segment can't be steered by anything
the user types, so there is no path-traversal surface even if username rules change.

These PDFs contain personal data (phone numbers, addresses) and are never served
directly — only the agent reads their text.
"""

import os
import uuid
from datetime import datetime, timezone

from dotenv import load_dotenv
from pypdf import PdfReader

load_dotenv()

STORAGE_DIR = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), os.getenv("CV_STORAGE_DIR", "CVs")
)

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB
MAX_PAGES = 30
PDF_MAGIC = b"%PDF-"


class InvalidCV(Exception):
    """Raised when an upload isn't a usable CV. The message is safe to return."""


def validate_pdf(contents: bytes, filename: str) -> None:
    if not contents:
        raise InvalidCV("The uploaded file is empty.")

    if len(contents) > MAX_UPLOAD_BYTES:
        raise InvalidCV(
            f"File is too large ({len(contents) // (1024 * 1024)} MB). "
            f"Maximum is {MAX_UPLOAD_BYTES // (1024 * 1024)} MB."
        )

    # Trust the bytes, not the extension or the client-supplied content type.
    if not contents.startswith(PDF_MAGIC):
        raise InvalidCV("That file is not a PDF.")


def store_cv(user_id: uuid.UUID, contents: bytes, filename: str) -> tuple[str, str]:
    """
    Validate, write to disk, and extract text.

    Returns (stored_path, extracted_text). Raises InvalidCV on bad input.
    """
    validate_pdf(contents, filename)

    user_dir = os.path.join(STORAGE_DIR, str(user_id))
    os.makedirs(user_dir, exist_ok=True)

    safe_name = os.path.basename(filename) or "cv.pdf"
    if not safe_name.lower().endswith(".pdf"):
        safe_name += ".pdf"

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    stored_path = os.path.join(user_dir, f"{timestamp}_{safe_name}")

    with open(stored_path, "wb") as f:
        f.write(contents)

    try:
        text = extract_text(stored_path)
    except InvalidCV:
        # Don't keep a file we can't read anything out of.
        os.remove(stored_path)
        raise

    return stored_path, text


def extract_text(path: str) -> str:
    try:
        reader = PdfReader(path)
    except Exception as e:
        raise InvalidCV(f"Could not read the PDF: {e}")

    if len(reader.pages) > MAX_PAGES:
        raise InvalidCV(f"PDF has too many pages (max {MAX_PAGES}).")

    text = "\n".join((page.extract_text() or "") for page in reader.pages)

    if not text.strip():
        raise InvalidCV(
            "No text could be extracted. If this is a scanned CV, it needs OCR first."
        )

    return text
