"""
Routes: the inbox and person-to-person threads.

All authenticated — escalating a question requires signing in, which is what
stops the feature becoming an anonymous way to put things in someone's inbox.
"""

import uuid

from fastapi import APIRouter, Depends

from app.api.deps import current_user, get_uow
from app.errors import NotFound
from app.models import Conversation, User
from app.repositories import UnitOfWork
from app.schemas import (
    ConversationOut,
    DirectMessageOut,
    ConversationSummary,
    EscalateRequest,
    InboxOut,
    MessageRequest,
    NotificationOut,
)
from app.services import accounts, conversations

router = APIRouter(prefix="/me", tags=["conversations"])


def _other_party(uow: UnitOfWork, conversation: Conversation, me: User) -> User | None:
    """None if the other participant's account has since been deleted."""
    other_id = (
        conversation.visitor_user_id
        if me.id == conversation.owner_user_id
        else conversation.owner_user_id
    )
    return uow.users.get(other_id)


def _summarise(uow: UnitOfWork, conversation: Conversation, me: User) -> ConversationSummary:
    other = _other_party(uow, conversation, me)
    return ConversationSummary(
        id=conversation.id,
        with_username=other.username if other else "unknown",
        with_display_name=other.display_name if other else "Deleted user",
        last_message_at=conversation.last_message_at,
    )


# ── inbox ───────────────────────────────────────────────────────────────────


@router.get("/notifications", response_model=InboxOut)
def inbox(user: User = Depends(current_user), uow: UnitOfWork = Depends(get_uow)):
    return InboxOut(
        unread=conversations.unread_count(uow, user),
        notifications=[
            NotificationOut.model_validate(n) for n in conversations.inbox(uow, user)
        ],
    )


@router.post("/notifications/{notification_id}/read", response_model=NotificationOut)
def mark_read(
    notification_id: uuid.UUID,
    user: User = Depends(current_user),
    uow: UnitOfWork = Depends(get_uow),
):
    return conversations.mark_read(uow, user, notification_id)


# ── threads ─────────────────────────────────────────────────────────────────


@router.get("/conversations", response_model=list[ConversationSummary])
def list_threads(user: User = Depends(current_user), uow: UnitOfWork = Depends(get_uow)):
    return [
        _summarise(uow, conversation, user)
        for conversation in conversations.threads(uow, user)
    ]


@router.get("/conversations/{conversation_id}", response_model=ConversationOut)
def read_thread(
    conversation_id: uuid.UUID,
    user: User = Depends(current_user),
    uow: UnitOfWork = Depends(get_uow),
):
    conversation = conversations.read(uow, user, conversation_id)
    other = _other_party(uow, conversation, user)

    return ConversationOut(
        id=conversation.id,
        with_username=other.username if other else "unknown",
        with_display_name=other.display_name if other else "Deleted user",
        messages=[DirectMessageOut.model_validate(m) for m in conversation.messages],
        agent_transcript=conversations.agent_transcript(uow, conversation),
    )


@router.post("/conversations/{conversation_id}/messages", response_model=ConversationOut)
def send_message(
    conversation_id: uuid.UUID,
    payload: MessageRequest,
    user: User = Depends(current_user),
    uow: UnitOfWork = Depends(get_uow),
):
    conversation = conversations.reply(uow, user, conversation_id, payload.body)
    other = _other_party(uow, conversation, user)

    return ConversationOut(
        id=conversation.id,
        with_username=other.username if other else "unknown",
        with_display_name=other.display_name if other else "Deleted user",
        messages=[DirectMessageOut.model_validate(m) for m in conversation.messages],
        agent_transcript=conversations.agent_transcript(uow, conversation),
    )


# ── escalation ──────────────────────────────────────────────────────────────

escalate_router = APIRouter(tags=["conversations"])


@escalate_router.post("/u/{username}/ask", response_model=ConversationSummary, status_code=201)
def ask_owner(
    username: str,
    payload: EscalateRequest,
    user: User = Depends(current_user),
    uow: UnitOfWork = Depends(get_uow),
):
    """Send the page owner a question the agent couldn't answer. Sign-in required."""
    owner = accounts.find_public(uow, username)
    if owner is None:
        raise NotFound("No such user.")

    conversation = conversations.escalate(
        uow,
        owner=owner,
        visitor=user,
        question=payload.question,
        visitor_token=payload.session_id,
    )
    return _summarise(uow, conversation, user)
