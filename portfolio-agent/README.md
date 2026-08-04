# portfolio-agent

Backend for a multi-tenant portfolio site. A user signs up, uploads their CV, and gets
a public page at `/u/{username}` where visitors chat with an agent that answers on their
behalf — and where the page's sections are generated from the CV by an LLM.

The React frontend lives in the sibling `portfolio-ui` repo.

## Requirements

- Python 3.12+ and [uv](https://docs.astral.sh/uv/)
- Docker (for Postgres)
- An OpenAI API key

## Setup

```bash
uv sync
```

Environment lives in `.env` (gitignored). It needs:

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | Agent replies and CV extraction |
| `DATABASE_URL` | `postgresql+psycopg://portfolio:portfolio@localhost:5433/portfolio` |
| `JWT_SECRET` | Signs auth tokens. Generate with `python -c "import secrets; print(secrets.token_urlsafe(48))"` |
| `JWT_EXPIRE_DAYS` | Token lifetime, default `7` |
| `CV_STORAGE_DIR` | Where uploaded PDFs go, default `CVs` |
| `ALLOWED_ORIGINS` | CORS allowlist, default `http://localhost:3000,http://127.0.0.1:3000` |

There is no default for `JWT_SECRET` on purpose — the app refuses to start without one
rather than signing tokens with a guessable value.

## Running

```bash
docker compose up -d
```

Postgres is published on host port **5433**, not 5432, so it won't collide with a locally
installed Postgres.

```bash
.venv/bin/alembic upgrade head
```

Create the first account and attach a CV (one time):

```bash
SEED_PASSWORD='choose-a-password' .venv/bin/python seed.py
```

This creates the `rahul` account, attaches `RR.pdf` as its active CV, and generates the
profile. Override with `SEED_USERNAME`, `SEED_EMAIL`, `SEED_CV`, etc. Re-running is safe.

Then start the API:

```bash
.venv/bin/uvicorn api:app --reload --port 8000
```

Interactive docs at http://localhost:8000/docs.

## Endpoints

| | |
| --- | --- |
| `POST /auth/signup` · `POST /auth/login` · `GET /auth/me` | Accounts |
| `POST /me/cv` · `GET /me/cvs` · `POST /me/cv/{id}/activate` | Upload, list, roll back |
| `GET /me/profile` · `PATCH /me/profile` | Generated content, incl. status; PATCH to hand-correct |
| `GET /u/{username}` | Public page data |
| `POST /u/{username}/chat` | Talk to that user's agent |

No account is privileged. Every portfolio — including whoever runs the site — is
served from `/u/{username}`; there is no single-tenant route.

## How it fits together

`storage.py` validates an upload (PDF magic bytes, 10 MB, 30 pages) and writes it under
`CVs/<user-uuid>/`. The directory is keyed on the UUID rather than the username so nothing
the user types can steer a path. Extracted text is cached on the `cvs` row, so the PDF is
parsed once at upload rather than on every chat turn.

`extractor.py` then runs in a `BackgroundTasks` job, calling the model with a strict JSON
schema that mirrors the props the React components already consume. The profile row moves
`pending → ready | failed`, which is why the dashboard polls.

`agent.py` rebuilds the system prompt from the *current* CV on every turn, so replacing a
CV takes effect mid-conversation instead of going stale.

## Things worth knowing

- **Uploaded CVs are never served.** They contain phone numbers and addresses. Only the
  agent reads their text, the extractor is told not to emit contact details, and the agent
  is told to refuse them even if asked directly. Don't add a static mount for `CVs/`.
- **`POST /u/{username}/chat` is unauthenticated and spends your OpenAI credit.** It is
  rate limited per IP (20/min), capped at 40 messages per session and 300 per owner per
  day. Those limits are the only thing between a stranger and your bill — the per-IP limit
  is in-process, so it weakens if you run multiple workers.
- **Usernames become URLs.** `schemas.py` holds a reserved-name list so nobody registers
  `admin`, `api`, `login` and so on.
- Signup returns a deliberately vague 409 on collision, so it can't be used to enumerate
  which emails are registered.

## Tests

There is no backend test suite yet — the work so far was verified by driving the API with
`curl` and the UI in a browser. That's the most obvious gap if you keep building on this.
