"""Routes: an owner managing their own account, CVs and page."""

import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, File, UploadFile

from app.api.deps import current_user, get_uow
from app.models import User
from app.repositories import UnitOfWork
from app.schemas import CVOut, ProfileOut, ProfileUpdate, UserOut, UserUpdate
from app.services import accounts, cvs
from app.services.generation import regenerate

router = APIRouter(prefix="/me", tags=["owner"])


@router.patch("", response_model=UserOut)
def update_account(
    payload: UserUpdate,
    user: User = Depends(current_user),
    uow: UnitOfWork = Depends(get_uow),
):
    return accounts.update_details(uow, user, payload.model_dump(exclude_unset=True))


@router.post("/cv", response_model=CVOut, status_code=201)
async def upload_cv(
    background: BackgroundTasks,
    file: UploadFile = File(...),
    user: User = Depends(current_user),
    uow: UnitOfWork = Depends(get_uow),
):
    contents = await file.read()
    return cvs.replace(
        uow,
        user,
        contents=contents,
        filename=file.filename or "cv.pdf",
        # Generation is slow, so it happens after this response is sent.
        schedule=lambda *args: background.add_task(regenerate, *args),
    )


@router.get("/cvs", response_model=list[CVOut])
def list_cvs(user: User = Depends(current_user), uow: UnitOfWork = Depends(get_uow)):
    return cvs.history(uow, user)


@router.post("/cv/{cv_id}/activate", response_model=CVOut)
def activate_cv(
    cv_id: uuid.UUID,
    background: BackgroundTasks,
    user: User = Depends(current_user),
    uow: UnitOfWork = Depends(get_uow),
):
    return cvs.activate(
        uow,
        user,
        cv_id,
        schedule=lambda *args: background.add_task(regenerate, *args),
    )


@router.get("/profile", response_model=ProfileOut)
def get_profile(user: User = Depends(current_user), uow: UnitOfWork = Depends(get_uow)):
    return cvs.profile_of(uow, user)


@router.patch("/profile", response_model=ProfileOut)
def correct_profile(
    payload: ProfileUpdate,
    user: User = Depends(current_user),
    uow: UnitOfWork = Depends(get_uow),
):
    return cvs.correct_profile(uow, user, payload.data)
