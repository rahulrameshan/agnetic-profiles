"""
CV and profile rules.

Replacing a CV, rolling back to an earlier one, and regenerating the page from
whichever is live. The regeneration itself is a slow model call, so callers hand
in a `schedule` callback and decide whether it runs in the background or inline.
"""

import os
import uuid
from datetime import datetime, timezone
from typing import Callable

from app.adapters import pdf
from app.errors import NotFound
from app.models import CV, Profile, User
from app.repositories import UnitOfWork

# A callable that arranges for regenerate() to run later.
Scheduler = Callable[..., None]


def _mark_for_regeneration(uow: UnitOfWork, user_id: uuid.UUID, cv_id: uuid.UUID) -> Profile:
    """Point the profile at a CV and flag it as awaiting generation."""
    profile = uow.profiles.get_or_create(user_id)
    profile.cv_id = cv_id
    profile.status = "pending"
    profile.error = None
    return profile


def replace(
    uow: UnitOfWork,
    user: User,
    *,
    contents: bytes,
    filename: str,
    schedule: Scheduler,
) -> CV:
    """
    Store an uploaded CV and make it the live one.

    Raises InvalidCV (from the pdf adapter) if the upload isn't usable, before
    anything is written to the database.
    """
    stored_path, text = pdf.store(user.id, contents, filename)

    uow.cvs.deactivate_all_for(user.id)

    cv = uow.cvs.add(
        CV(
            user_id=user.id,
            original_filename=os.path.basename(filename or "cv.pdf"),
            stored_path=stored_path,
            size_bytes=len(contents),
            extracted_text=text,
            is_active=True,
        )
    )

    _mark_for_regeneration(uow, user.id, cv.id)
    uow.commit()

    schedule(user.id, cv.id)
    return cv


def activate(
    uow: UnitOfWork, user: User, cv_id: uuid.UUID, *, schedule: Scheduler
) -> CV:
    """Roll back to an earlier upload and regenerate the page from it."""
    cv = uow.cvs.get(cv_id)

    # Someone else's CV is reported as missing rather than forbidden, so the
    # endpoint can't be used to probe which ids exist.
    if cv is None or cv.user_id != user.id:
        raise NotFound("No such CV.")

    uow.cvs.deactivate_all_for(user.id)
    cv.is_active = True

    _mark_for_regeneration(uow, user.id, cv.id)
    uow.commit()

    schedule(user.id, cv.id)
    return cv


def history(uow: UnitOfWork, user: User) -> list[CV]:
    return uow.cvs.list_for(user.id)


def profile_of(uow: UnitOfWork, user: User) -> Profile:
    profile = uow.profiles.get_or_create(user.id)
    uow.commit()
    return profile


def correct_profile(uow: UnitOfWork, user: User, data: dict) -> Profile:
    """Accept hand-edited content, which supersedes whatever was generated."""
    profile = uow.profiles.get_or_create(user.id)
    profile.data = data
    profile.status = "ready"
    profile.error = None
    profile.generated_at = datetime.now(timezone.utc)
    uow.commit()
    return profile


def public_profile(uow: UnitOfWork, user: User) -> Profile | None:
    return uow.profiles.for_user(user.id)
