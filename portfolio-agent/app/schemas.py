"""
schemas.py
----------
Request/response models for the API.

Note the split between UserPublic and PublicProfileOut: the public page payload
deliberately carries no email, so a visitor can never harvest contact details
from someone's page.
"""

import re
import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator

USERNAME_RE = re.compile(r"^[a-z0-9](?:[a-z0-9-]{1,37}[a-z0-9])$")
HEX_COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")

# Usernames become URL segments, so anything that would collide with a real
# route (or with a future one) is refused at signup.
RESERVED_USERNAMES = {
    "about", "admin", "api", "auth", "chat", "dashboard", "docs", "health",
    "login", "logout", "me", "privacy", "profile", "root", "settings",
    "signup", "static", "support", "terms", "u", "user", "users",
}


class SignupRequest(BaseModel):
    username: str
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    display_name: str = Field(min_length=1, max_length=120)
    headline: str | None = Field(default=None, max_length=200)
    location: str | None = Field(default=None, max_length=120)

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        v = v.strip().lower()
        if not USERNAME_RE.match(v):
            raise ValueError(
                "Username must be 3-39 characters, lowercase letters, numbers or "
                "hyphens, and start and end with a letter or number."
            )
        if v in RESERVED_USERNAMES:
            raise ValueError("That username is reserved.")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str


class UserOut(BaseModel):
    """The authenticated owner's own view — includes email."""

    id: uuid.UUID
    username: str
    email: EmailStr
    display_name: str
    headline: str | None
    location: str | None
    theme_color: str

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    """Owner-editable account fields. Every field is optional — omitted means unchanged."""

    display_name: str | None = Field(default=None, min_length=1, max_length=120)
    headline: str | None = Field(default=None, max_length=200)
    location: str | None = Field(default=None, max_length=120)
    theme_color: str | None = None

    @field_validator("theme_color")
    @classmethod
    def validate_theme_color(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip().lower()
        if not HEX_COLOR_RE.match(v):
            raise ValueError("Colour must be a hex value like #00ff00.")
        return v


class CVOut(BaseModel):
    id: uuid.UUID
    original_filename: str
    size_bytes: int
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ProfileOut(BaseModel):
    """Owner-facing profile view, including extraction status and errors."""

    status: str
    data: dict
    error: str | None = None
    generated_at: datetime | None = None

    model_config = {"from_attributes": True}


class ProfileUpdate(BaseModel):
    """Hand-correct the generated content."""

    data: dict


class PublicProfileOut(BaseModel):
    """What an anonymous visitor sees. No email, no raw CV text."""

    username: str
    display_name: str
    headline: str | None
    location: str | None
    theme_color: str
    status: str
    data: dict


class UserSummary(BaseModel):
    """One row in the public directory. No email — same rule as PublicProfileOut."""

    username: str
    display_name: str
    headline: str | None
    location: str | None
    theme_color: str
    has_profile: bool


class ChatRequest(BaseModel):
    session_id: str = Field(min_length=1, max_length=100)
    message: str = Field(min_length=1, max_length=2000)


class ChatResponse(BaseModel):
    session_id: str
    response: str


# ── escalation, notifications and direct chat ────────────────────────────────


class EscalateRequest(BaseModel):
    """A signed-in visitor sending the owner a question the agent couldn't answer."""

    question: str = Field(min_length=1, max_length=2000)
    session_id: str | None = Field(
        default=None,
        max_length=100,
        description="Agent session this came from, so the owner gets the context.",
    )


class NotificationOut(BaseModel):
    id: uuid.UUID
    kind: str
    body: str
    is_read: bool
    conversation_id: uuid.UUID | None
    created_at: datetime

    model_config = {"from_attributes": True}


class InboxOut(BaseModel):
    unread: int
    notifications: list[NotificationOut]


class DirectMessageOut(BaseModel):
    id: uuid.UUID
    sender_user_id: uuid.UUID
    body: str
    created_at: datetime

    model_config = {"from_attributes": True}


class MessageRequest(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


class ConversationSummary(BaseModel):
    """A row in the threads list. `with_*` describes the other person."""

    id: uuid.UUID
    with_username: str
    with_display_name: str
    last_message_at: datetime

    model_config = {"from_attributes": True}


class ConversationOut(BaseModel):
    id: uuid.UUID
    with_username: str
    with_display_name: str
    messages: list[DirectMessageOut]
    # The agent exchange that prompted the escalation, shown to give context.
    agent_transcript: list[dict]
