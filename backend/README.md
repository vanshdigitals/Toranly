# Toranly backend

A stateless FastAPI companion for the guest-first Toranly web app.

- **Plans never reach the server's storage.** They live in the browser (IndexedDB). The server stores
  only AI usage counters (three tables).
- **AI goes through the server only.** The xAI key never leaves the backend. The browser calls
  `/api/v1/ai/status` and `/api/v1/ai/suggest`; nothing else.
- **No accounts.** A signed, HttpOnly device cookie (`tdv`) identifies a browser for rate limits;
  only `SHA-256(device id)` is stored.

Stack: Python 3.14, FastAPI 0.162, Pydantic 2.14, SQLAlchemy 2.1 + psycopg 3.3, Alembic 1.20,
OpenAI Python SDK 3.40 (pointed at `https://api.x.ai/v1`). Exact pins: `pyproject.toml`,
`uv.lock`, and the hash-locked `requirements.txt` used by the Docker image.

## Layout

```
backend/
  app/
    main.py              app factory, middleware, routers, Problem Details, web app serving
    core/                config, security (cookie, IP hash, Origin, headers, body limit),
                         ratelimit (Postgres counters, token bucket, in-memory limiter),
                         errors (RFC 9457), logging (JSON + redaction), clock
    api/v1/              health.py, plan.py (+ plan_models.py), ai.py
    domain/              money, templates, budget_engine, timeline_engine, dependency_graph,
                         quote_compare, guests, schedule   (pure Python, no I/O)
    ai/                  provider protocol, xai_client, context, contracts/, prompts/,
                         guards, usage, orchestrator
    db/                  models.py, session.py, cleanup.py, alembic/
  tests/                 unit/, api/, ai/ (FakeProvider + fixtures), db/ (Postgres), parity/
  scripts/estimate_costs.py
  Dockerfile, docker-compose.yml, .env.example
```

## Run locally

Prerequisites: [uv](https://docs.astral.sh/uv/) and Docker (for Postgres). Node 24 for the web app.

```bash
cd backend
uv sync                                         # creates .venv from uv.lock
docker compose up -d                            # Postgres on localhost:5432 (+ toranly_test DB)
cp .env.example .env                            # then edit .env (see "Add your xAI key safely")
uv run alembic upgrade head
uv run uvicorn app.main:app_factory --factory --reload --port 8000
```

In another terminal, run the web app. Vite proxies `/api` to `localhost:8000`:

```bash
npm --prefix web run dev                        # http://localhost:5173
```

With `XAI_API_KEY` empty the app runs normally. The AI tab says "AI suggestions aren't available right
now", and `plan.generate` / `timeline.suggest` return the standard template, marked as such.

API docs (development only): http://localhost:8000/docs

## Test

```bash
cd backend
uv run ruff check . && uv run ruff format --check . && uv run mypy
uv run pytest -m "not live"                     # unit, API, AI (fake provider), parity, DB
uv run pytest -m live -s                        # real xAI calls, one per contract; costs money
uv run pip-audit -r requirements.txt --disable-pip
npm --prefix ../web test                        # includes the Vitest parity suite
```

Database tests use `TEST_DATABASE_URL` (default
`postgresql+psycopg://toranly:toranly@localhost:5432/toranly_test`) and are skipped if it is not
reachable. They run migrations down and up, so never point them at a database you care about.

Regenerate the shared parity fixtures after an intentional engine change:

```bash
uv run python -m tests.parity.generate_fixtures
```

## Providers and failover

xAI (Grok) is the primary provider and Groq the fallback (`AI_PRIMARY_PROVIDER`, `AI_FALLBACK_PROVIDER`, `AI_FAILOVER_ENABLED`). Groq is used automatically when xAI times out, errors, is rate limited, is out of credits or has a bad key; it is never used to retry a refusal. Rules and limits: celebration-event-planner-docs/AI_SAFETY.md §10. Both keys go in `backend/.env` only:

- `XAI_API_KEY`: from console.x.ai, starts with `xai-`.
- `GROQ_API_KEY`: from console.groq.com, starts with `gsk_`. `GROQ_MODEL` must support strict JSON schema (`openai/gpt-oss-120b` or `openai/gpt-oss-20b`). `GROQ_ACCOUNT_RPM` / `GROQ_ACCOUNT_TPM` come from console.groq.com > Settings > Limits.

Smoke test (never part of the test suite or CI):

```bash
uv run python -m scripts.ai_smoke              # mocked failover, free
uv run python -m scripts.ai_smoke --live       # one small real request to xAI and to Groq
uv run python -m scripts.ai_smoke --live --provider groq
```

## Add your xAI key safely

1. Create the key in the xAI Console. Give it the narrowest scope the console offers (this app
   only needs the Responses / Chat API for your model).
2. Put it **only** in `backend/.env` (git-ignored) locally, or in your host's secret environment
   variables in production (Render: *Environment* → *Secret*). Never put it in `web/`, never use a
   `VITE_` prefix, never paste it into an issue or chat.
3. Generate the two app secrets the same way:
   ```bash
   python -c "import secrets; print(secrets.token_urlsafe(64))"   # SESSION_SECRET
   python -c "import secrets; print(secrets.token_urlsafe(32))"   # IP_HASH_SALT
   ```
4. Copy your account limits from the xAI Console. Open **Models** for your team and find the row for
   your model (`grok-4.3`). The page shows **requests per second (RPS)** and **tokens per minute
   (TPM)**, not RPM. xAI derives RPS as `max(2, RPM / 48)` (docs.x.ai, "Consumption and rate
   limits"), so:
   - `XAI_ACCOUNT_TPM` = the TPM shown.
   - `XAI_ACCOUNT_RPM` = RPS × 48 when RPS is above 2. When RPS shows 2, the docs don't let you
     recover the exact RPM (it is 96 or less), so set a value you know is safe, for example 60.

   The app then uses at most `XAI_SAFETY_FACTOR` (80%) of these. TPM counts all tokens, including
   reasoning tokens.
5. Run the live smoke test once: `uv run pytest -m live -s`. It prints real token usage and cost
   per contract. If the Responses API rejects the request shape, set `XAI_API_STYLE=chat` and run
   it again.
6. Check the prices on docs.x.ai (Models → pricing) before release and update
   `XAI_PRICE_INPUT_PER_M` / `XAI_PRICE_OUTPUT_PER_M`. The spend cap depends on them.

The key never appears in responses or logs. A test sends a sentinel key through every endpoint and
failure path and checks; logs also redact anything shaped like `xai-…`. Another test scans
`web/dist` for keys, `api.x.ai` and `XAI_` names.

## Deploy (Render + Neon)

Step-by-step guide, cold starts and smoke checks: [DEPLOYMENT.md](../celebration-event-planner-docs/DEPLOYMENT.md).
The image builds the web app and serves it from the same origin (ARCHITECTURE.md §7):

```bash
docker build -f backend/Dockerfile -t toranly .         # from the repository root
```

On every start the container runs `alembic upgrade head` (retries the first connection for about
a minute while a sleeping Neon database wakes, and holds a Postgres advisory lock so two
instances never migrate at once), then Uvicorn as the non-root user `app` (uid 10001).
Health: `GET /api/v1/health` (liveness, no database; also the Docker `HEALTHCHECK`) and
`GET /api/v1/health/ready` (database ping plus provider states, no paid call).
Old usage rows (more than 30 days) are deleted at startup and once a day, or manually with
`python -m app.db.cleanup`.

### Production environment checklist

Set every value in **Render → your service → Environment** (secrets as plain environment
variables; Render encrypts them at rest). Never put them in the repository, the image, the
web build or `VITE_*` variables. "Required" means the app refuses to start, or AI stays off,
without it.

| Variable | Production value | Where it comes from | Required |
|---|---|---|---|
| `APP_ENV` | `production` | already the image default | yes |
| `DATABASE_URL` | `postgresql+psycopg://USER:PASSWORD@HOST/DB?sslmode=require` | Neon → project → **Connection string** (use the pooled host, change the scheme to `postgresql+psycopg://`) | yes |
| `SESSION_SECRET` | 32+ random bytes, e.g. `python -c "import secrets; print(secrets.token_urlsafe(48))"` | generate locally once | yes (refuses to start) |
| `IP_HASH_SALT` | 32+ random bytes, generated the same way (a different value) | generate locally once | yes (refuses to start) |
| `APP_ORIGIN` | `https://<service>.onrender.com` (exact, no trailing slash) | Render service URL | strongly recommended |
| `TRUSTED_PROXY_CIDRS` | Render's proxy range; `10.0.0.0/8` is typical, **verify** once from the logs | Render | recommended (else all users share one IP bucket) |
| `XAI_API_KEY` | `xai-…` | console.x.ai → API keys (the account needs credits) | for xAI |
| `XAI_ACCOUNT_RPM`, `XAI_ACCOUNT_TPM` | your account's limits | console.x.ai → model rate limits | yes, or xAI stays off |
| `GROQ_API_KEY` | `gsk_…` | console.groq.com → API keys | for the fallback |
| `GROQ_ACCOUNT_RPM`, `GROQ_ACCOUNT_TPM` | your account's limits (free tier: 30 RPM, 8,000 TPM for `openai/gpt-oss-120b`; check the console) | console.groq.com → limits | yes, or Groq stays off |
| `AI_DAILY_SPEND_LIMIT_USD` | e.g. `2.00` (default) | your budget | recommended |
| `AI_LIMIT_PER_DEVICE_PER_DAY` / `_PER_MINUTE` | `5` / `2` (defaults) | product choice | no |
| `AI_LIMIT_PER_IP_PER_DAY`, `AI_GLOBAL_DAILY_LIMIT` | `20`, `100` (defaults) | product choice | no |
| `AI_PRIMARY_PROVIDER`, `AI_FALLBACK_PROVIDER`, `AI_FAILOVER_ENABLED` | `xai`, `groq`, `true` (defaults) | — | no |
| `XAI_MODEL`, `GROQ_MODEL`, `XAI_API_STYLE` | `grok-4.3`, `openai/gpt-oss-120b`, `responses` | — | no |
| `XAI_PRICE_*_PER_M`, `GROQ_PRICE_*_PER_M` | list prices used for the spend cap | provider pricing pages | no (keep current) |
| `AI_REQUEST_TIMEOUT_SECONDS`, `AI_MAX_RETRIES_PER_PROVIDER`, `AI_FAILOVER_COOLDOWN_SECONDS` | `30`, `1`, `60` | — | no |
| `AI_MAX_OUTPUT_TOKENS`, `AI_MAX_CONCURRENT`, `XAI_SAFETY_FACTOR` | `2500`, `3`, `0.8` | — | no |
| `API_LIMIT_PER_IP_PER_MINUTE`, `MAX_BODY_BYTES` | `60`, `65536` | — | no |
| `WEB_CONCURRENCY` | `1` (the image runs one worker) | — | no |
| `CORS_ORIGINS` | empty (same origin; ignored in production) | — | no |
| `STATIC_DIR` | `/app/static` (image default) | — | no |
| `AI_FAKE_PROVIDER` | **never set** (refused outside `APP_ENV=test`) | — | — |

After the first deploy: open `/api/v1/health/ready` (expect `"database": "ok"` and each
provider `ok`), then run one AI suggestion from the AI plan tab and check the logs for
`ai_suggest` with `outcome: ready`. Rotate any key that was ever pasted into a chat, ticket
or commit.

## Notes and limits

- The provider guard (token bucket + semaphore) is in memory and per process. With more workers,
  set `WEB_CONCURRENCY` so each worker takes its share. The Postgres counters (device, IP, global,
  spend) are shared and exact across workers.
- The general API limit (`API_LIMIT_PER_IP_PER_MINUTE`) is in memory and resets on restart.
- The circuit breaker and the "AI disabled after 401/403" state are per process and reset on
  restart. Fix the key, then restart.
