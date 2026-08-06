"""
Routes: what an anonymous visitor sees.

Everything here is unauthenticated, so each response is built explicitly rather
than serialising a model — that way a column added later can't accidentally
become public.
"""

from fastapi import APIRouter, Depends, Request

from app.api.deps import get_uow
from app.api.limiter import limiter
from app.config import settings
from app.errors import NotFound
from app.models import User
from app.repositories import UnitOfWork
from app.schemas import ChatRequest, ChatResponse, PublicProfileOut, UserSummary
from app.services import accounts, chat, cvs

router = APIRouter(tags=["public"])


def _require_public_user(uow: UnitOfWork, username: str) -> User:
    user = accounts.find_public(uow, username)
    if user is None:
        raise NotFound("No such user.")
    return user


@router.get("/users", response_model=list[UserSummary])
def list_users(uow: UnitOfWork = Depends(get_uow)):
    """Directory of everyone with a page. Carries no more than a profile does."""
    return [
        UserSummary(
            username=user.username,
            display_name=user.display_name,
            headline=user.headline,
            location=user.location,
            theme_color=user.theme_color,
            has_profile=has_profile,
        )
        for user, has_profile in accounts.list_directory(uow)
    ]


@router.get("/u/{username}", response_model=PublicProfileOut)
def public_profile(username: str, uow: UnitOfWork = Depends(get_uow)):
    user = _require_public_user(uow, username)
    profile = cvs.public_profile(uow, user)

    return PublicProfileOut(
        username=user.username,
        display_name=user.display_name,
        headline=user.headline,
        location=user.location,
        theme_color=user.theme_color,
        status=profile.status if profile else "empty",
        data=profile.data if profile else {},
    )


@router.post("/u/{username}/chat", response_model=ChatResponse)
@limiter.limit(settings.chat_rate_limit)
def public_chat(
    request: Request,
    username: str,
    payload: ChatRequest,
    uow: UnitOfWork = Depends(get_uow),
):
    # Sync on purpose: the model call blocks, so FastAPI runs this in a threadpool
    # rather than stalling the event loop for every other request.
    owner = _require_public_user(uow, username)
    answer = chat.ask(
        uow, owner, visitor_token=payload.session_id, question=payload.message
    )
    return ChatResponse(session_id=payload.session_id, response=answer)
