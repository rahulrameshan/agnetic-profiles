"""
Regenerating a profile from a CV.

Kept apart from the CV service because it runs on its own: after the response has
been sent, in a background task, with its own database session. Anything that
fails here is recorded on the profile rather than surfaced to a caller who has
already been answered.
"""

import uuid
from datetime import datetime, timezone

from app.adapters import llm
from app.db import SessionLocal
from app.repositories import UnitOfWork


def regenerate(user_id: uuid.UUID, cv_id: uuid.UUID) -> None:
    """
    Generate a user's page content from one of their CVs.

    Opens its own session: by the time this runs the request-scoped one is closed.
    """
    db = SessionLocal()
    try:
        uow = UnitOfWork(db)
        profile = uow.profiles.for_user(user_id)
        cv = uow.cvs.get(cv_id)

        if profile is None or cv is None:
            return

        try:
            profile.data = llm.extract_profile(cv.extracted_text)
            profile.status = "ready"
            profile.error = None
            profile.generated_at = datetime.now(timezone.utc)
        except Exception as e:
            # The owner sees this on their dashboard; there is no request left to fail.
            profile.status = "failed"
            profile.error = str(e)[:1000]

        uow.commit()
    finally:
        db.close()
