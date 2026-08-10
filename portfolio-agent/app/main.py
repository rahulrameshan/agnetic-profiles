"""
Application assembly.

The only file that knows about every layer: it wires routers, middleware and
error handling together and hands back an app. Nothing here contains a rule.

    uvicorn app.main:app
"""

from typing import Any, cast

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api import auth, conversations, me, public
from app.api.errors import register_error_handlers
from app.api.limiter import limiter
from app.config import settings


def create_app() -> FastAPI:
    app = FastAPI(title="Portfolio Agent")

    app.state.limiter = limiter
    # slowapi types its handler for RateLimitExceeded specifically, which is
    # narrower than the Exception that Starlette declares.
    app.add_exception_handler(RateLimitExceeded, cast(Any, _rate_limit_exceeded_handler))
    register_error_handlers(app)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(auth.router)
    app.include_router(me.router)
    app.include_router(conversations.router)
    app.include_router(conversations.escalate_router)
    app.include_router(public.router)

    @app.get("/health", tags=["ops"])
    def health():
        return {"status": "ok"}

    return app


app = create_app()
