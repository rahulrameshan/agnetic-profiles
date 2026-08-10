"""
Escalating a question to a human, and the conversation that follows.

The rules here: who may escalate, who may read a thread, and how often a person
may pester an owner. The agent decides it can't answer; this decides what
happens next.
"""

import uuid

from app.errors import LimitReached, NotFound, PermissionDenied
from app.models import Conversation, Notification, User
from app.repositories import UnitOfWork

# An escalation puts an item in someone else's inbox, so it needs its own cap —
# looser chat limits are not enough to stop one person flooding an owner.
MAX_ESCALATIONS_PER_DAY = 10

KIND_QUESTION = "question_escalated"
KIND_MESSAGE = "message_received"


def _thread_for(
    uow: UnitOfWork,
    owner: User,
    visitor: User,
    chat_session_id: uuid.UUID | None,
) -> Conversation:
    """One thread per pair — escalating twice continues rather than duplicates."""
    existing = uow.conversations.between(owner.id, visitor.id)
    if existing:
        return existing
    return uow.conversations.start(owner.id, visitor.id, chat_session_id)


def escalate(
    uow: UnitOfWork,
    *,
    owner: User,
    visitor: User,
    question: str,
    visitor_token: str | None = None,
) -> Conversation:
    """
    A signed-in visitor asks the owner something the agent couldn't answer.

    Creates (or reuses) the thread, posts the question as its first message, and
    notifies the owner.
    """
    if owner.id == visitor.id:
        raise PermissionDenied("You can't send yourself a question.")

    if uow.notifications.count_today_from(visitor.id) >= MAX_ESCALATIONS_PER_DAY:
        raise LimitReached(
            "You've sent a lot of questions today. Please try again tomorrow."
        )

    # Tie the agent transcript to the thread so the owner has the context, and
    # record who the previously anonymous visitor turned out to be.
    session = (
        uow.chats.find_session(owner.id, visitor_token) if visitor_token else None
    )
    if session is not None:
        uow.chats.link_visitor(session, visitor.id)

    conversation = _thread_for(
        uow, owner, visitor, session.id if session else None
    )
    uow.conversations.add_message(conversation, visitor.id, question)

    uow.notifications.add(
        user_id=owner.id,
        actor_user_id=visitor.id,
        conversation_id=conversation.id,
        kind=KIND_QUESTION,
        body=f"{visitor.display_name} asked: {question}",
    )

    uow.commit()
    return conversation


def _require_participant(conversation: Conversation | None, user: User) -> Conversation:
    """Non-participants get 'not found', not 'forbidden' — no probing for threads."""
    if conversation is None:
        raise NotFound("No such conversation.")

    if user.id not in (conversation.owner_user_id, conversation.visitor_user_id):
        raise NotFound("No such conversation.")

    return conversation


def read(uow: UnitOfWork, user: User, conversation_id: uuid.UUID) -> Conversation:
    return _require_participant(uow.conversations.get(conversation_id), user)


def reply(
    uow: UnitOfWork, user: User, conversation_id: uuid.UUID, body: str
) -> Conversation:
    """Post a message and notify whoever is on the other side."""
    conversation = _require_participant(uow.conversations.get(conversation_id), user)

    uow.conversations.add_message(conversation, user.id, body)

    recipient_id = (
        conversation.visitor_user_id
        if user.id == conversation.owner_user_id
        else conversation.owner_user_id
    )
    uow.notifications.add(
        user_id=recipient_id,
        actor_user_id=user.id,
        conversation_id=conversation.id,
        kind=KIND_MESSAGE,
        body=f"{user.display_name}: {body}",
    )

    uow.commit()
    return conversation


def threads(uow: UnitOfWork, user: User) -> list[Conversation]:
    return uow.conversations.list_for(user.id)


def agent_transcript(uow: UnitOfWork, conversation: Conversation) -> list[dict]:
    """
    The agent exchange that led here, as plain {role, content} pairs.

    Only what a person said or was told — tool plumbing is dropped, since it is
    noise to a human reading for context.
    """
    if conversation.chat_session_id is None:
        return []

    session = uow.chats.find_session_by_id(conversation.chat_session_id)
    if session is None:
        return []

    return [
        {"role": message.raw.get("role"), "content": message.raw.get("content")}
        for message in session.messages
        if message.raw.get("role") in ("user", "assistant")
        and message.raw.get("content")
    ]


# ── inbox ───────────────────────────────────────────────────────────────────


def inbox(uow: UnitOfWork, user: User) -> list[Notification]:
    return uow.notifications.list_for(user.id)


def unread_count(uow: UnitOfWork, user: User) -> int:
    return uow.notifications.count_unread(user.id)


def mark_read(uow: UnitOfWork, user: User, notification_id: uuid.UUID) -> Notification:
    notification = uow.notifications.get(notification_id)

    if notification is None or notification.user_id != user.id:
        raise NotFound("No such notification.")

    notification.is_read = True
    uow.commit()
    return notification
