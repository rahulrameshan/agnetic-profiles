# Backend: FastAPI + uvicorn.
#
# Runs a SINGLE worker on purpose. Rate limiting (slowapi) counts in-process, so
# extra workers would multiply the effective limits on the public chat endpoint —
# and that endpoint spends OpenAI credit. Scale by raising the limits knowingly,
# not by adding workers.

FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:0.5.11 /uv /usr/local/bin/uv

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

# Dependencies first so code changes don't invalidate the layer.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project

COPY . .
RUN uv sync --frozen

EXPOSE 8000

# Migrations run on boot, so a deploy never serves against an old schema.
CMD ["sh", "-c", "uv run alembic upgrade head && uv run uvicorn api:app --host 0.0.0.0 --port 8000 --workers 1"]
