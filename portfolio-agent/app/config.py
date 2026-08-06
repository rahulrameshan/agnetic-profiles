"""
Every environment variable the application reads, in one place.

Previously these were scattered across five modules, so answering "what does
this service need to run?" meant grepping. Now it's this file.
"""

import os

from dotenv import load_dotenv

load_dotenv()


class Settings:
    # ── Database ──────────────────────────────────────────────
    database_url: str = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg://portfolio:portfolio@localhost:5433/portfolio",
    )

    # ── Auth ──────────────────────────────────────────────────
    jwt_secret: str | None = os.getenv("JWT_SECRET")
    jwt_algorithm: str = "HS256"
    jwt_expire_days: int = int(os.getenv("JWT_EXPIRE_DAYS", "7"))

    # ── Model ─────────────────────────────────────────────────
    openai_model: str = os.getenv("OPENAI_MODEL", "gpt-4o")
    max_answer_tokens: int = 1024

    # ── CV storage ────────────────────────────────────────────
    cv_storage_dir: str = os.getenv("CV_STORAGE_DIR", "CVs")
    max_upload_bytes: int = 10 * 1024 * 1024
    max_pdf_pages: int = 30

    # ── Abuse limits on the public chat endpoint ──────────────
    # It is unauthenticated and spends the operator's OpenAI credit.
    chat_rate_limit: str = "20/minute"
    max_messages_per_session: int = 40
    max_owner_messages_per_day: int = 300

    # ── HTTP ──────────────────────────────────────────────────
    # Browsers treat localhost and 127.0.0.1 as different origins, so both dev
    # spellings are allowed by default.
    allowed_origins: list[str] = [
        o.strip()
        for o in os.getenv(
            "ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
        ).split(",")
        if o.strip()
    ]

    def validate(self) -> None:
        """Fail at import rather than on the first request that needs a secret."""
        if not self.jwt_secret:
            raise RuntimeError(
                "JWT_SECRET is not set. Add it to .env — tokens must never be "
                "signed with a default value."
            )


settings = Settings()
settings.validate()
