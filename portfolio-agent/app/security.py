"""
Password hashing and token issuing.

Deliberately free of FastAPI: these are pure functions the account service uses.
Turning a bearer header into a User is an HTTP concern and lives in app/api/deps.py.

bcrypt is used directly rather than through passlib, which is unmaintained and
breaks against bcrypt >= 4.
"""

import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.config import settings

# bcrypt silently truncates past 72 bytes, so over-long passwords are rejected
# at the schema layer rather than being quietly shortened here.
MAX_PASSWORD_BYTES = 72


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


def create_access_token(user_id: uuid.UUID) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(days=settings.jwt_expire_days),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def read_access_token(token: str) -> uuid.UUID | None:
    """Return the subject, or None if the token is missing, invalid or expired."""
    try:
        payload = jwt.decode(
            token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
        )
        return uuid.UUID(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        return None
