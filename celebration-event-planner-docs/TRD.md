# Technical Requirements

Project: Celebration & Event Planner (temporary name).
Related: [ARCHITECTURE.md](ARCHITECTURE.md), [RESEARCH_REPORT.md](RESEARCH_REPORT.md) §8.

## 1. Runtime

Backend versions pinned in `backend/pyproject.toml` and locked with hashes in `backend/uv.lock` and `backend/requirements.txt` on 2026-10-28:

| Component | Pinned version |
|---|---|
| Python | 3.14 (3.14.6 used locally; image `python:3.14-slim`) |
| FastAPI | 0.162.0 (Starlette 1.10.0) |
| Pydantic / pydantic-settings | 2.14.1 / 2.16.2 |
| SQLAlchemy | 2.1.6 |
| psycopg (binary) | 3.3.6 |
| Alembic | 1.20.1 |
| openai (Python SDK, used with the xAI base URL) | 3.40.0 |
| Uvicorn | 0.54.0 |
| tzdata | 2026.6 |
| Dev: pytest, httpx, hypothesis | 9.2.0, 0.28.1, 6.170.12 |
| Dev: Ruff, mypy (strict on `app/domain` and `app/ai`), pip-audit | 0.17.3, 2.4.0, 2.10.1 |
| Package manager | uv 0.11.26 |
| Web build | Node 24 (image `node:24.11-slim`); web packages per `web/package-lock.json` |

Decision [D, revised]: SQLAlchemy stays synchronous; async route handlers call it through a worker thread (`anyio.to_thread`). The xAI call uses the async OpenAI client so concurrency can be capped with an `asyncio.Semaphore`.

## 2. Responsibilities (Guest-First Architecture)

| Layer | Owns |
|---|---|
| Frontend Client Storage | Local persistence via IndexedDB (`toranly` DB: `plans`, `snapshots`, `meta`) with in-memory fallback, schema migration (`migrate()`), `.toranly.json` backup export/import (2MB limit). |
| Frontend Domain Engines | Largest-remainder paise arithmetic (`money.ts`), budget metrics & status (`budget.ts`), due dates from offsets & date change preview & cycle detection (`timeline.ts`), quote normalisation (`quotes.ts`), diet validation (`guests.ts`), schedule overlap detection (`schedule.ts`), CSV export with formula injection escaping (`export.ts`). |
| Backend (`backend/`) | Stateless AI suggestions (`/api/v1/ai/status`, `/api/v1/ai/suggest`), stateless Python reference endpoints (`/api/v1/plan/*`), layered rate limits and spend cap, secret isolation (the xAI key never leaves the backend). Account sync is a later phase. |
| Database (Neon Postgres) | AI usage counters only (`ai_usage`, `ai_ip_usage`, `ai_global_usage`). No event data in this phase. |

Under Guest-First Planning (Option C), the browser is the primary execution and data store. All arithmetic, validation, and storage happen locally without mandatory network dependency.

## 3. API communication

REST JSON under `/api/v1`, same origin in production (Vite proxy in development). No accounts and no CSRF token in this phase: state-changing requests must carry an `Origin` header matching the app origin, and AI requests need the signed device cookie (SECURITY.md §10). FastAPI's OpenAPI and `/docs` exist in development only.

## 4. Browser support

Latest two versions of Chrome, Edge, Firefox, Safari (desktop and mobile). Minimum width 320px.

## 5. Operational constraints

| Constraint | Source | Effect |
|---|---|---|
| Render Free sleeps after 15 min idle; about 1 min wake | RR §8.3 [V] | Warm before demos |
| Render Free ephemeral filesystem, may restart | [V] | No local files; all state in Postgres |
| Neon Free 0.5 GB, 100 CU-hours, 5 GB transfer per project per month | RR §8.2 [V] | Monitor in Neon console |
| xAI per-model rate limits, 429 | [V] | Backoff and per-user limits |
| AI request 45 s budget | NFR-03 | Synchronous generation; no background jobs |

## 6. Configuration (`backend/.env.example`)

All values are server-side only. Production refuses to start when `SESSION_SECRET` or `IP_HASH_SALT` is missing or shorter than 32 bytes, or when `CORS_ORIGINS` contains `*`.

| Variable | Default | Notes |
|---|---|---|
| `APP_ENV` | development | development, test, production |
| `DATABASE_URL` | local Postgres | `postgresql+psycopg://…`; Neon needs `sslmode=require` |
| `SESSION_SECRET` | (empty) | signs the device cookie; 64+ random bytes recommended |
| `IP_HASH_SALT` | (empty) | HMAC key for IP hashes |
| `XAI_API_KEY` | (empty) | empty = AI disabled with an honest message |
| `XAI_BASE_URL`, `XAI_MODEL` | `https://api.x.ai/v1`, `grok-4.3` | |
| `XAI_API_STYLE` | responses | `chat` switches to the Chat Completions fallback adapter |
| `XAI_ACCOUNT_RPM`, `XAI_ACCOUNT_TPM` | (empty) | from the xAI Console Models page; empty = AI off in production, RPM 10 and TPM 20000 in development |
| `XAI_SAFETY_FACTOR` | 0.8 | share of each provider's account limits the app may use (xAI and Groq) |
| `GROQ_API_KEY` | (empty) | fallback provider; empty = no fallback |
| `GROQ_BASE_URL`, `GROQ_MODEL` | `https://api.groq.com/openai/v1`, `openai/gpt-oss-120b` | the model must support strict `json_schema` |
| `GROQ_ACCOUNT_RPM`, `GROQ_ACCOUNT_TPM` | (empty) | console.groq.com Limits page; empty = Groq off in production, RPM 10 and TPM 8000 in development |
| `GROQ_PRICE_INPUT_PER_M`, `GROQ_PRICE_OUTPUT_PER_M` | 0.15, 0.60 | USD per 1M tokens (gpt-oss-120b; console.groq.com/docs/models checked 2026-10-29) |
| `AI_PRIMARY_PROVIDER`, `AI_FALLBACK_PROVIDER` | xai, groq | `xai`, `groq`; fallback also `none` |
| `AI_FAILOVER_ENABLED` | true | |
| `AI_REQUEST_TIMEOUT_SECONDS` | 30 | per provider call; the old name `XAI_TIMEOUT_SECONDS` is still accepted; 45 s total per request |
| `AI_MAX_RETRIES_PER_PROVIDER` | 1 | 0 to 2; transient, rate-limit and JSON-repair retries share it |
| `AI_FAILOVER_COOLDOWN_SECONDS` | 60 | provider skipped this long after billing errors or an outage |
| `XAI_PRICE_INPUT_PER_M`, `XAI_PRICE_OUTPUT_PER_M` | 1.25, 2.50 | USD per 1M tokens (grok-4.3, prompts under 200k tokens; docs.x.ai checked 2026-10-28) |
| `AI_MAX_OUTPUT_TOKENS` | 2500 | |
| `AI_MAX_CONCURRENT` | 3 | asyncio semaphore |
| `AI_LIMIT_PER_DEVICE_PER_MINUTE`, `AI_LIMIT_PER_DEVICE_PER_DAY` | 2, 5 | counted once per user request, across providers |
| `AI_LIMIT_PER_IP_PER_DAY` | 20 | |
| `AI_GLOBAL_DAILY_LIMIT` | 100 | requests per UTC day (not provider billing units) |
| `AI_DAILY_SPEND_LIMIT_USD` | 2.00 | estimated USD per UTC day |
| `API_LIMIT_PER_IP_PER_MINUTE` | 60 | in memory, per process |
| `CORS_ORIGINS` | `http://localhost:5173` | development only; ignored in production |
| `MAX_BODY_BYTES` | 65536 | 413 above this |
| `APP_ORIGIN` | (empty) | exact production origin for the Origin check; empty = compare with the Host header |
| `TRUSTED_PROXY_CIDRS` | (empty) | peers whose `X-Forwarded-For` is trusted (Render's proxy) |
| `WEB_CONCURRENCY` | 1 | worker count; the per-process provider guard divides its budget by it |
| `STATIC_DIR` | (empty; `/app/static` in the image) | built web app to serve |

The brief suggested `GROK_API_KEY` and `GROK_MODEL`. Decision [D]: use `XAI_API_KEY` and `XAI_MODEL` to match xAI's documentation. No variable is exposed to the frontend build (checked by `backend/tests/api/test_security.py` and CI).

## 7. Dependencies policy

- No paid dependency is required for core features (NFR-08). xAI usage is the only paid service and is optional at runtime.
- No Supabase dependency.
- New dependencies need a reason in the PR description (CONTRIBUTING.md).
