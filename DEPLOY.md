# Deploying

Everything runs on one machine from one compose file: Postgres, the FastAPI
backend, and Caddy serving the React bundle and proxying `/api` to the backend.
Because the API is served from the same origin as the site, there is no CORS in
production and the browser only ever talks to one domain.

## 1. A server

Any small VPS works — 2 GB RAM is comfortable (Hetzner CX22, DigitalOcean 2 GB).
Install Docker:

```bash
curl -fsSL https://get.docker.com | sh
```

## 2. Point the domain at it

Two DNS records at your registrar:

| Type | Name | Value |
| --- | --- | --- |
| A | `@` | your server's IPv4 |
| A | `www` | your server's IPv4 |

Wait until `dig +short yourdomain.com` returns the server IP before starting the
stack — Caddy requests a certificate on boot, and that fails if DNS hasn't
propagated. Make sure ports 80 and 443 are open.

## 3. Configure

```bash
git clone <your-repo> portfolio-agent && cd portfolio-agent
cp .env.prod.example .env
```

Fill in `.env`. Generate fresh secrets — do not copy the development ones:

```bash
openssl rand -base64 24                                        # POSTGRES_PASSWORD
python3 -c "import secrets; print(secrets.token_urlsafe(48))"  # JWT_SECRET
```

## 4. Start

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

The API container runs `alembic upgrade head` before serving, so the schema is
created on first boot and migrated on every deploy. Caddy obtains the TLS
certificate automatically; the first request may take a few seconds.

Create the first account through `/signup` in the browser.

## Updating

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

## Backups

Two volumes hold everything irreplaceable:

```bash
# Database
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U portfolio portfolio | gzip > backup-$(date +%F).sql.gz

# Uploaded CVs
docker run --rm -v portfolio-agent_cvdata:/data -v "$PWD":/out alpine \
  tar czf /out/cvs-$(date +%F).tar.gz -C /data .
```

`cvdata` holds people's actual CV documents. Losing it breaks every profile,
because the agent answers from the extracted text and the file is the only copy.

## Things to know

- **One backend worker, on purpose.** Rate limiting is in-process, so extra
  workers would multiply the effective limits on `/u/{username}/chat` — an
  unauthenticated endpoint that spends your OpenAI credit. If you need more
  throughput, raise the limits deliberately in `api.py` rather than adding
  workers, or move rate limiting into Postgres or Redis first.
- **Postgres is not published to the host.** Only the `api` service can reach it.
  To inspect it, go through `docker compose exec postgres psql`.
- **`REACT_APP_AGENT_URL` is baked in at build time**, not read at runtime. It is
  set to `/api` by the compose build arg; changing it means rebuilding `web`.
- **Uploaded CVs are never served as files.** They contain phone numbers and
  addresses. Don't add a static route for the `cvdata` volume.
- **`*.pdf` is in `.dockerignore`**, so the sample CVs aren't baked into the
  image. `seed.py` therefore won't find `RR.pdf` in the container — use `/signup`
  instead, which is the normal path now that no account is special.
- **Cost exposure.** On a public domain, anyone can chat with any profile's agent
  and each message costs you. Current caps: 20/min per IP, 40 messages per
  conversation, 300/day per profile. Review them before you publicise the URL.
