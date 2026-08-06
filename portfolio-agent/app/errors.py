"""
Domain errors.

Services raise these; they know nothing about HTTP. The API layer maps them to
status codes in exactly one place (app/api/errors.py). That separation is the
main reason this package exists: business rules stay testable without a web
framework, and a rule change can't accidentally alter a status code.
"""


class DomainError(Exception):
    """Base for anything the application refuses to do, with a safe message."""

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class NotFound(DomainError):
    """The thing asked for doesn't exist, or isn't the caller's to see."""


class AlreadyExists(DomainError):
    """A uniqueness rule would be violated."""


class NotAuthenticated(DomainError):
    """Missing or invalid credentials."""


class PermissionDenied(DomainError):
    """Authenticated, but not allowed."""


class InvalidCV(DomainError):
    """An upload isn't a usable CV. The message is safe to show the user."""


class NoActiveCV(DomainError):
    """An owner has no CV, so their agent has nothing to answer from."""


class LimitReached(DomainError):
    """A rate or quota limit stopped the request."""


class AgentUnavailable(DomainError):
    """The upstream model call failed."""
