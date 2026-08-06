"""
The single place domain errors become HTTP.

Services say what went wrong in business terms; this table decides the status
code. Adding a rule doesn't mean touching a route, and changing a status code
doesn't mean touching a rule.
"""

from fastapi import Request, status
from fastapi.responses import JSONResponse

from app.errors import (
    AgentUnavailable,
    AlreadyExists,
    DomainError,
    InvalidCV,
    LimitReached,
    NoActiveCV,
    NotAuthenticated,
    NotFound,
    PermissionDenied,
)

STATUS_FOR = {
    NotFound: status.HTTP_404_NOT_FOUND,
    AlreadyExists: status.HTTP_409_CONFLICT,
    NotAuthenticated: status.HTTP_401_UNAUTHORIZED,
    PermissionDenied: status.HTTP_403_FORBIDDEN,
    InvalidCV: status.HTTP_400_BAD_REQUEST,
    NoActiveCV: status.HTTP_409_CONFLICT,
    LimitReached: status.HTTP_429_TOO_MANY_REQUESTS,
    AgentUnavailable: status.HTTP_502_BAD_GATEWAY,
}


async def handle_domain_error(request: Request, exc: DomainError) -> JSONResponse:
    code = STATUS_FOR.get(type(exc), status.HTTP_400_BAD_REQUEST)

    headers = (
        {"WWW-Authenticate": "Bearer"}
        if code == status.HTTP_401_UNAUTHORIZED
        else None
    )

    return JSONResponse(
        status_code=code, content={"detail": exc.message}, headers=headers
    )


def register_error_handlers(app) -> None:
    app.add_exception_handler(DomainError, handle_domain_error)
