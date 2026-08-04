"""
api.py
------
Multi-tenant API.

Three groups of routes:
  /auth/*            signup, login, whoami
  /me/*              the authenticated owner managing their own CV and profile
  /u/{username}/*    what an anonymous visitor sees: the generated page and the agent

The public chat endpoint is unauthenticated and spends the platform's OpenAI
credit, so it is rate limited per IP, capped per session, and capped per owner
per day.
"""

import os
import uuid
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
from fastapi import (
    BackgroundTasks,
    Depends,
    FastAPI,
    File,
    HTTPException,
    Request,
    UploadFile,
    status,
)
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from agent import run_agent_once
from auth import create_access_token, get_current_user, hash_password, verify_password
from db import get_db
from extractor import run_extraction
from models import CV, ChatMessage, ChatSession, Profile, User
from schemas import (
    ChatRequest,
    ChatResponse,
    CVOut,
    LoginRequest,
    ProfileOut,
    ProfileUpdate,
    PublicProfileOut,
    SignupRequest,
    TokenResponse,
    UserOut,
    UserSummary,
    UserUpdate,
)
from storage import InvalidCV, store_cv

load_dotenv()

app = FastAPI(title="Portfolio Agent")

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Browsers treat localhost and 127.0.0.1 as different origins, so both dev spellings
# are allowed by default — otherwise a preflight from one of them fails with a 400
# that looks like a server bug rather than a CORS allowlist miss.
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS", "*"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in ALLOWED_ORIGINS],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Abuse limits for the public chat endpoint.
MAX_MESSAGES_PER_SESSION = 40
MAX_OWNER_MESSAGES_PER_DAY = 300


# ── helpers ──────────────────────────────────────────────────────────────────


def _get_user_by_username(db: Session, username: str) -> User:
    user = db.scalar(select(User).where(User.username == username.lower()))
    if user is None or not user.is_active:
        raise HTTPException(status_code=404, detail="No such user.")
    return user


def _active_cv(db: Session, user_id: uuid.UUID) -> CV | None:
    return db.scalar(
        select(CV).where(CV.user_id == user_id, CV.is_active.is_(True))
    )


def _get_or_create_profile(db: Session, user_id: uuid.UUID) -> Profile:
    profile = db.scalar(select(Profile).where(Profile.user_id == user_id))
    if profile is None:
        profile = Profile(user_id=user_id, data={}, status="empty")
        db.add(profile)
        db.flush()
    return profile


# ── auth ─────────────────────────────────────────────────────────────────────


@app.post("/auth/signup", response_model=TokenResponse, status_code=201)
def signup(payload: SignupRequest, db: Session = Depends(get_db)):
    existing = db.scalar(
        select(User).where(
            (User.username == payload.username) | (User.email == payload.email)
        )
    )
    if existing is not None:
        # Deliberately vague: this endpoint is unauthenticated, and naming which
        # field collided turns it into an account-enumeration oracle.
        raise HTTPException(
            status_code=409, detail="That username or email is already registered."
        )

    user = User(
        username=payload.username,
        email=payload.email,
        password_hash=hash_password(payload.password),
        display_name=payload.display_name,
        headline=payload.headline,
        location=payload.location,
    )
    db.add(user)
    db.flush()

    _get_or_create_profile(db, user.id)
    db.commit()

    return TokenResponse(
        access_token=create_access_token(user.id), username=user.username
    )


@app.post("/auth/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == payload.email))

    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password.")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="This account is disabled.")

    return TokenResponse(
        access_token=create_access_token(user.id), username=user.username
    )


@app.get("/auth/me", response_model=UserOut)
def whoami(user: User = Depends(get_current_user)):
    return user


@app.patch("/me", response_model=UserOut)
def update_me(
    payload: UserUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update owner-editable account fields. Omitted fields are left alone."""
    for field, value in payload.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(user, field, value)

    db.commit()
    db.refresh(user)
    return user


# ── owner: CVs ───────────────────────────────────────────────────────────────


@app.post("/me/cv", response_model=CVOut, status_code=201)
async def upload_my_cv(
    background: BackgroundTasks,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    contents = await file.read()

    try:
        stored_path, text = store_cv(user.id, contents, file.filename or "cv.pdf")
    except InvalidCV as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Previous CVs stay on record but stop being the live one.
    db.query(CV).filter(CV.user_id == user.id, CV.is_active.is_(True)).update(
        {"is_active": False}
    )

    cv = CV(
        user_id=user.id,
        original_filename=os.path.basename(file.filename or "cv.pdf"),
        stored_path=stored_path,
        size_bytes=len(contents),
        extracted_text=text,
        is_active=True,
    )
    db.add(cv)
    db.flush()

    profile = _get_or_create_profile(db, user.id)
    profile.cv_id = cv.id
    profile.status = "pending"
    profile.error = None

    db.commit()

    background.add_task(run_extraction, user.id, cv.id)
    return cv


@app.get("/me/cvs", response_model=list[CVOut])
def list_my_cvs(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return list(
        db.scalars(
            select(CV).where(CV.user_id == user.id).order_by(CV.created_at.desc())
        )
    )


@app.post("/me/cv/{cv_id}/activate", response_model=CVOut)
def activate_cv(
    cv_id: uuid.UUID,
    background: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cv = db.get(CV, cv_id)
    if cv is None or cv.user_id != user.id:
        raise HTTPException(status_code=404, detail="No such CV.")

    db.query(CV).filter(CV.user_id == user.id, CV.is_active.is_(True)).update(
        {"is_active": False}
    )
    cv.is_active = True

    profile = _get_or_create_profile(db, user.id)
    profile.cv_id = cv.id
    profile.status = "pending"
    profile.error = None

    db.commit()

    background.add_task(run_extraction, user.id, cv.id)
    return cv


# ── owner: profile ───────────────────────────────────────────────────────────


@app.get("/me/profile", response_model=ProfileOut)
def get_my_profile(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = _get_or_create_profile(db, user.id)
    db.commit()
    return profile


@app.patch("/me/profile", response_model=ProfileOut)
def update_my_profile(
    payload: ProfileUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Hand-correct generated content. Marks the profile ready."""
    profile = _get_or_create_profile(db, user.id)
    profile.data = payload.data
    profile.status = "ready"
    profile.error = None
    profile.generated_at = datetime.now(timezone.utc)
    db.commit()
    return profile


# ── public ───────────────────────────────────────────────────────────────────


@app.get("/users", response_model=list[UserSummary])
def list_users(db: Session = Depends(get_db)):
    """
    Public directory of everyone with a page.

    Carries only what /u/{username} already exposes — no email — so the
    directory reveals nothing a visitor couldn't see by opening a profile.
    Ordered newest first so recent signups are discoverable.
    """
    rows = db.execute(
        select(User, Profile.status)
        .join(Profile, Profile.user_id == User.id, isouter=True)
        .where(User.is_active.is_(True))
        .order_by(User.created_at.desc())
        .limit(200)
    ).all()

    return [
        UserSummary(
            username=user.username,
            display_name=user.display_name,
            headline=user.headline,
            location=user.location,
            theme_color=user.theme_color,
            has_profile=status == "ready",
        )
        for user, status in rows
    ]


@app.get("/u/{username}", response_model=PublicProfileOut)
def public_profile(username: str, db: Session = Depends(get_db)):
    user = _get_user_by_username(db, username)
    profile = db.scalar(select(Profile).where(Profile.user_id == user.id))

    return PublicProfileOut(
        username=user.username,
        display_name=user.display_name,
        headline=user.headline,
        location=user.location,
        theme_color=user.theme_color,
        status=profile.status if profile else "empty",
        data=profile.data if profile else {},
    )


def _chat_turn(db: Session, owner: User, visitor_token: str, message: str) -> str:
    cv = _active_cv(db, owner.id)
    if cv is None:
        raise HTTPException(
            status_code=409,
            detail=f"{owner.display_name} hasn't uploaded a CV yet.",
        )

    session = db.scalar(
        select(ChatSession).where(
            ChatSession.owner_user_id == owner.id,
            ChatSession.visitor_token == visitor_token,
        )
    )
    if session is None:
        session = ChatSession(owner_user_id=owner.id, visitor_token=visitor_token)
        db.add(session)
        db.flush()

    history = [m.raw for m in session.messages]

    if sum(1 for m in history if m.get("role") == "user") >= MAX_MESSAGES_PER_SESSION:
        raise HTTPException(
            status_code=429, detail="This conversation has reached its message limit."
        )

    since = datetime.now(timezone.utc) - timedelta(days=1)
    todays_messages = db.scalar(
        select(func.count(ChatMessage.id))
        .join(ChatSession, ChatMessage.session_id == ChatSession.id)
        .where(
            ChatSession.owner_user_id == owner.id,
            ChatMessage.role == "user",
            ChatMessage.created_at >= since,
        )
    )
    if (todays_messages or 0) >= MAX_OWNER_MESSAGES_PER_DAY:
        raise HTTPException(
            status_code=429,
            detail="This page has reached its daily limit. Please try again tomorrow.",
        )

    try:
        answer, appended = run_agent_once(
            cv_text=cv.extracted_text,
            history=history,
            user_input=message,
            display_name=owner.display_name,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Agent error: {e}")

    for raw in appended:
        db.add(
            ChatMessage(session_id=session.id, role=raw.get("role", "assistant"), raw=raw)
        )
    db.commit()

    return answer


@app.post("/u/{username}/chat", response_model=ChatResponse)
@limiter.limit("20/minute")
def public_chat(
    request: Request,
    username: str,
    payload: ChatRequest,
    db: Session = Depends(get_db),
):
    # Defined sync on purpose: the OpenAI call blocks, so FastAPI runs this in a
    # threadpool rather than stalling the event loop for every other request.
    owner = _get_user_by_username(db, username)
    answer = _chat_turn(db, owner, payload.session_id, payload.message)
    return ChatResponse(session_id=payload.session_id, response=answer)


@app.get("/health")
def health():
    return {"status": "ok"}
