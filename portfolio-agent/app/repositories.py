"""
Persistence. Every SQL query in the application lives here.

Repositories expose intention-revealing methods ("the active CV for this owner")
rather than query builders, so the services above them read as business rules
instead of joins. The UnitOfWork bundles them with the transaction boundary, so
a service never touches a Session and never imports SQLAlchemy.
"""

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    CV,
    ChatMessage,
    ChatSession,
    Conversation,
    DirectMessage,
    Notification,
    Profile,
    User,
)


class UserRepository:
    def __init__(self, db: Session):
        self._db = db

    def get(self, user_id: uuid.UUID) -> User | None:
        return self._db.get(User, user_id)

    def find_by_username(self, username: str) -> User | None:
        return self._db.scalar(select(User).where(User.username == username.lower()))

    def find_by_email(self, email: str) -> User | None:
        return self._db.scalar(select(User).where(User.email == email))

    def exists_with_username_or_email(self, username: str, email: str) -> bool:
        found = self._db.scalar(
            select(User.id).where((User.username == username) | (User.email == email))
        )
        return found is not None

    def add(self, user: User) -> User:
        self._db.add(user)
        self._db.flush()
        return user

    def list_active_with_profile_status(
        self, limit: int = 200
    ) -> list[tuple[User, str | None]]:
        """The public directory read model: each user plus their profile status."""
        rows = self._db.execute(
            select(User, Profile.status)
            .join(Profile, Profile.user_id == User.id, isouter=True)
            .where(User.is_active.is_(True))
            .order_by(User.created_at.desc())
            .limit(limit)
        ).all()
        return [(user, status) for user, status in rows]


class CVRepository:
    def __init__(self, db: Session):
        self._db = db

    def get(self, cv_id: uuid.UUID) -> CV | None:
        return self._db.get(CV, cv_id)

    def active_for(self, user_id: uuid.UUID) -> CV | None:
        return self._db.scalar(
            select(CV).where(CV.user_id == user_id, CV.is_active.is_(True))
        )

    def list_for(self, user_id: uuid.UUID) -> list[CV]:
        return list(
            self._db.scalars(
                select(CV).where(CV.user_id == user_id).order_by(CV.created_at.desc())
            )
        )

    def deactivate_all_for(self, user_id: uuid.UUID) -> None:
        """Older CVs stay on record; they just stop being the live one."""
        self._db.query(CV).filter(
            CV.user_id == user_id, CV.is_active.is_(True)
        ).update({"is_active": False})

    def add(self, cv: CV) -> CV:
        self._db.add(cv)
        self._db.flush()
        return cv


class ProfileRepository:
    def __init__(self, db: Session):
        self._db = db

    def for_user(self, user_id: uuid.UUID) -> Profile | None:
        return self._db.scalar(select(Profile).where(Profile.user_id == user_id))

    def get_or_create(self, user_id: uuid.UUID) -> Profile:
        profile = self.for_user(user_id)
        if profile is None:
            profile = Profile(user_id=user_id, data={}, status="empty")
            self._db.add(profile)
            self._db.flush()
        return profile


class ChatRepository:
    def __init__(self, db: Session):
        self._db = db

    def find_session(
        self, owner_id: uuid.UUID, visitor_token: str
    ) -> ChatSession | None:
        return self._db.scalar(
            select(ChatSession).where(
                ChatSession.owner_user_id == owner_id,
                ChatSession.visitor_token == visitor_token,
            )
        )

    def find_session_by_id(self, session_id: uuid.UUID) -> ChatSession | None:
        return self._db.get(ChatSession, session_id)

    def start_session(self, owner_id: uuid.UUID, visitor_token: str) -> ChatSession:
        session = ChatSession(owner_user_id=owner_id, visitor_token=visitor_token)
        self._db.add(session)
        self._db.flush()
        return session

    def history(self, session: ChatSession) -> list[dict]:
        """Prior messages as raw OpenAI dicts, oldest first."""
        return [message.raw for message in session.messages]

    def link_visitor(self, session: ChatSession, visitor_user_id: uuid.UUID) -> None:
        """Attach a now-signed-in visitor to the session they chatted under."""
        session.visitor_user_id = visitor_user_id

    def append(self, session: ChatSession, messages: list[dict]) -> None:
        for raw in messages:
            self._db.add(
                ChatMessage(
                    session_id=session.id,
                    role=raw.get("role", "assistant"),
                    raw=raw,
                )
            )

    def count_visitor_messages_today(self, owner_id: uuid.UUID) -> int:
        since = datetime.now(timezone.utc) - timedelta(days=1)
        total = self._db.scalar(
            select(func.count(ChatMessage.id))
            .join(ChatSession, ChatMessage.session_id == ChatSession.id)
            .where(
                ChatSession.owner_user_id == owner_id,
                ChatMessage.role == "user",
                ChatMessage.created_at >= since,
            )
        )
        return total or 0


class ConversationRepository:
    def __init__(self, db: Session):
        self._db = db

    def get(self, conversation_id: uuid.UUID) -> Conversation | None:
        return self._db.get(Conversation, conversation_id)

    def between(
        self, owner_id: uuid.UUID, visitor_id: uuid.UUID
    ) -> Conversation | None:
        return self._db.scalar(
            select(Conversation).where(
                Conversation.owner_user_id == owner_id,
                Conversation.visitor_user_id == visitor_id,
            )
        )

    def start(
        self,
        owner_id: uuid.UUID,
        visitor_id: uuid.UUID,
        chat_session_id: uuid.UUID | None,
    ) -> Conversation:
        conversation = Conversation(
            owner_user_id=owner_id,
            visitor_user_id=visitor_id,
            chat_session_id=chat_session_id,
        )
        self._db.add(conversation)
        self._db.flush()
        return conversation

    def list_for(self, user_id: uuid.UUID) -> list[Conversation]:
        """Threads this user takes part in, most recently active first."""
        return list(
            self._db.scalars(
                select(Conversation)
                .where(
                    (Conversation.owner_user_id == user_id)
                    | (Conversation.visitor_user_id == user_id)
                )
                .order_by(Conversation.last_message_at.desc())
            )
        )

    def add_message(
        self, conversation: Conversation, sender_id: uuid.UUID, body: str
    ) -> DirectMessage:
        message = DirectMessage(
            conversation_id=conversation.id, sender_user_id=sender_id, body=body
        )
        self._db.add(message)
        conversation.last_message_at = datetime.now(timezone.utc)
        self._db.flush()
        return message


class NotificationRepository:
    def __init__(self, db: Session):
        self._db = db

    def get(self, notification_id: uuid.UUID) -> Notification | None:
        return self._db.get(Notification, notification_id)

    def add(
        self,
        *,
        user_id: uuid.UUID,
        actor_user_id: uuid.UUID | None,
        conversation_id: uuid.UUID | None,
        kind: str,
        body: str,
    ) -> Notification:
        notification = Notification(
            user_id=user_id,
            actor_user_id=actor_user_id,
            conversation_id=conversation_id,
            kind=kind,
            body=body,
        )
        self._db.add(notification)
        self._db.flush()
        return notification

    def list_for(self, user_id: uuid.UUID, limit: int = 50) -> list[Notification]:
        return list(
            self._db.scalars(
                select(Notification)
                .where(Notification.user_id == user_id)
                .order_by(Notification.created_at.desc())
                .limit(limit)
            )
        )

    def count_unread(self, user_id: uuid.UUID) -> int:
        total = self._db.scalar(
            select(func.count(Notification.id)).where(
                Notification.user_id == user_id, Notification.is_read.is_(False)
            )
        )
        return total or 0

    def count_today_from(self, actor_id: uuid.UUID) -> int:
        """Escalations this person raised in the last day — the abuse guard."""
        since = datetime.now(timezone.utc) - timedelta(days=1)
        total = self._db.scalar(
            select(func.count(Notification.id)).where(
                Notification.actor_user_id == actor_id,
                Notification.created_at >= since,
            )
        )
        return total or 0


class UnitOfWork:
    """
    One transaction, and the repositories that participate in it.

    Services depend on this and nothing else from the persistence side, which is
    what keeps them free of SQLAlchemy.
    """

    def __init__(self, db: Session):
        self._db = db
        self.users = UserRepository(db)
        self.cvs = CVRepository(db)
        self.profiles = ProfileRepository(db)
        self.chats = ChatRepository(db)
        self.conversations = ConversationRepository(db)
        self.notifications = NotificationRepository(db)

    def commit(self) -> None:
        self._db.commit()

    def refresh(self, instance) -> None:
        self._db.refresh(instance)
