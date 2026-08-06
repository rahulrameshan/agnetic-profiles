"""
Request-scoped dependencies.

This is where HTTP becomes domain: a bearer header turns into a User, a session
turns into a UnitOfWork. Nothing below this layer knows a request exists.
"""

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.db import get_db
from app.errors import NotAuthenticated
from app.models import User
from app.repositories import UnitOfWork
from app.security import read_access_token

bearer_scheme = HTTPBearer(auto_error=False)


def get_uow(db: Session = Depends(get_db)) -> UnitOfWork:
    return UnitOfWork(db)


def current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    uow: UnitOfWork = Depends(get_uow),
) -> User:
    if credentials is None:
        raise NotAuthenticated("Not authenticated")

    user_id = read_access_token(credentials.credentials)
    if user_id is None:
        raise NotAuthenticated("Not authenticated")

    user = uow.users.get(user_id)
    if user is None or not user.is_active:
        raise NotAuthenticated("Not authenticated")

    return user
