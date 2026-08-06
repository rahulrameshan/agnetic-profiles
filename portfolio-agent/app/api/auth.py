"""Routes: registering and signing in."""

from fastapi import APIRouter, Depends

from app.api.deps import current_user, get_uow
from app.models import User
from app.repositories import UnitOfWork
from app.schemas import LoginRequest, SignupRequest, TokenResponse, UserOut
from app.services import accounts

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=TokenResponse, status_code=201)
def signup(payload: SignupRequest, uow: UnitOfWork = Depends(get_uow)):
    user, token = accounts.register(
        uow,
        username=payload.username,
        email=payload.email,
        password=payload.password,
        display_name=payload.display_name,
        headline=payload.headline,
        location=payload.location,
    )
    return TokenResponse(access_token=token, username=user.username)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, uow: UnitOfWork = Depends(get_uow)):
    user, token = accounts.authenticate(
        uow, email=payload.email, password=payload.password
    )
    return TokenResponse(access_token=token, username=user.username)


@router.get("/me", response_model=UserOut)
def whoami(user: User = Depends(current_user)):
    return user
