"""
Talking to somebody's agent.

The rules here are about who may ask, how often, and from which document — the
model call itself belongs to the llm adapter.
"""

from app.adapters import llm
from app.config import settings
from app.errors import LimitReached, NoActiveCV
from app.models import User
from app.repositories import UnitOfWork


def _check_conversation_length(history: list[dict]) -> None:
    asked = sum(1 for message in history if message.get("role") == "user")
    if asked >= settings.max_messages_per_session:
        raise LimitReached("This conversation has reached its message limit.")


def _check_daily_quota(uow: UnitOfWork, owner: User) -> None:
    if uow.chats.count_visitor_messages_today(owner.id) >= settings.max_owner_messages_per_day:
        raise LimitReached(
            "This page has reached its daily limit. Please try again tomorrow."
        )


def ask(uow: UnitOfWork, owner: User, *, visitor_token: str, question: str) -> str:
    """
    Answer one question on an owner's behalf, from their active CV.

    Conversations are scoped to (owner, visitor), so two visitors on the same
    page never share a thread and one visitor never carries context between pages.
    """
    cv = uow.cvs.active_for(owner.id)
    if cv is None:
        raise NoActiveCV(f"{owner.display_name} hasn't uploaded a CV yet.")

    session = uow.chats.find_session(owner.id, visitor_token) or uow.chats.start_session(
        owner.id, visitor_token
    )
    history = uow.chats.history(session)

    _check_conversation_length(history)
    _check_daily_quota(uow, owner)

    answer, new_messages = llm.answer_question(
        cv_text=cv.extracted_text,
        history=history,
        question=question,
        display_name=owner.display_name,
    )

    uow.chats.append(session, new_messages)
    uow.commit()

    return answer
