"""
Account rules: registering, signing in, editing your own details.

No FastAPI, no SQLAlchemy, no HTTP status codes — just what the business allows,
expressed against a UnitOfWork.
"""

from app.errors import AlreadyExists, NotAuthenticated, PermissionDenied
from app.models import User
from app.repositories import UnitOfWork
from app.security import create_access_token, hash_password, verify_password


def register(
    uow: UnitOfWork,
    *,
    username: str,
    email: str,
    password: str,
    display_name: str,
    headline: str | None = None,
    location: str | None = None,
) -> tuple[User, str]:
    """Create an account and its empty profile. Returns (user, access token)."""
    if uow.users.exists_with_username_or_email(username, email):
        # Deliberately vague: naming which field collided would turn this
        # unauthenticated endpoint into an account-enumeration oracle.
        raise AlreadyExists("That username or email is already registered.")

    user = uow.users.add(
        User(
            username=username,
            email=email,
            password_hash=hash_password(password),
            display_name=display_name,
            headline=headline,
            location=location,
        )
    )

    # Every account has a profile from the start, so reads never special-case None.
    uow.profiles.get_or_create(user.id)
    uow.commit()

    return user, create_access_token(user.id)


def authenticate(uow: UnitOfWork, *, email: str, password: str) -> tuple[User, str]:
    """Verify credentials. Returns (user, access token)."""
    user = uow.users.find_by_email(email)

    if user is None or not verify_password(password, user.password_hash):
        raise NotAuthenticated("Incorrect email or password.")

    if not user.is_active:
        raise PermissionDenied("This account is disabled.")

    return user, create_access_token(user.id)


def update_details(uow: UnitOfWork, user: User, changes: dict) -> User:
    """Apply owner-editable fields. Absent keys are left alone."""
    for field, value in changes.items():
        if value is not None:
            setattr(user, field, value)

    uow.commit()
    uow.refresh(user)
    return user


def find_public(uow: UnitOfWork, username: str) -> User | None:
    """The user behind a public page, or None if there isn't one."""
    user = uow.users.find_by_username(username)
    return user if user and user.is_active else None


def list_directory(uow: UnitOfWork) -> list[tuple[User, bool]]:
    """Everyone with a page, each flagged with whether it is generated yet."""
    return [
        (user, status == "ready")
        for user, status in uow.users.list_active_with_profile_status()
    ]
