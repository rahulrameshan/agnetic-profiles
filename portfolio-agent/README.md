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
.venv/bin/uvicorn app.main:app --reload --port 8000
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

## Structure

Dependencies point one way: routes → services → repositories/adapters. A layer never
imports the one above it, which is checked mechanically — services contain no `fastapi`,
no `sqlalchemy` and no `openai` import.

```
app/
  main.py            assembles the app; contains no rules
  config.py          every environment variable, in one place
  errors.py          domain errors (NotFound, InvalidCV, LimitReached, …)
  prompts.py         how the agent must behave — a business rule, edited often
  profile_schema.py  what a generated profile IS
  models.py          SQLAlchemy tables
  schemas.py         request/response DTOs
  security.py        password hashing, token issuing (pure functions)
  repositories.py    every SQL query, plus the UnitOfWork
  services/          business rules — the layer worth reading first
    accounts.py        register, authenticate, edit, directory
    cvs.py             replace, roll back, correct a profile
    generation.py      regenerate page content from a CV
    chat.py            one conversational turn, and its limits
  adapters/          the outside world
    pdf.py             validate, store, extract text
    llm.py             answer a question, extract a profile
    github.py          the fetch_github tool and its schema
  api/               HTTP only
    deps.py            bearer header → User, session → UnitOfWork
    errors.py          domain error → status code, in one table
    auth.py me.py public.py
```

Services take a `UnitOfWork` rather than a database session, so they never touch
SQLAlchemy. They raise domain errors rather than `HTTPException`, so a rule change can't
alter a status code and a status code change can't alter a rule.

Two behaviours worth knowing, both deliberate: `pdf.store` deletes the file it just wrote
if no text can be extracted, so an unreadable upload leaves nothing behind; and
`llm.answer_question` rebuilds the system prompt from the *current* CV on every turn, so
replacing a CV takes effect mid-conversation instead of going stale.

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
