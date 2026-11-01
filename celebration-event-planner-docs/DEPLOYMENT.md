# Deployment: Render Free + Neon Free

Toranly ships as **one Docker image**: the React app is built in the first stage and served by
FastAPI from the same origin, so there is no CORS and the device cookie stays first-party.
Plans live in each visitor's browser (IndexedDB); Postgres only holds AI usage counters.

> Nothing in this guide has been deployed yet. Every step that creates a public URL or a
> paid resource needs the owner's go-ahead.

Plan details (free-tier hours, storage, sleep timers) change; check Render's and Neon's
pricing pages before relying on the numbers below.

## 1. Neon (database)

1. Create a project (region close to the Render region, for example Singapore for India).
2. Copy the **pooled** connection string from *Connection details*.
3. Change the scheme for SQLAlchemy and keep TLS on:
   `postgresql+psycopg://USER:PASSWORD@ep-…-pooler.REGION.aws.neon.tech/neondb?sslmode=require`
4. Nothing else: the container creates the tables on its first start (`alembic upgrade head`).

The database stores only AI usage rows (device and IP hashes, counts, token totals, cost). No
plan, name or contact detail is ever sent to the server.

## 2. Render (web service)

1. *New → Web Service →* connect the GitHub repository.
2. **Runtime:** Docker. **Root directory:** repository root. **Dockerfile path:** `backend/Dockerfile`.
3. **Instance type:** Free. **Health check path:** `/api/v1/health`.
4. **Environment:** every variable in the checklist in
   [backend/README.md](../backend/README.md#production-environment-checklist). At minimum:
   `DATABASE_URL`, `SESSION_SECRET`, `IP_HASH_SALT`, `APP_ORIGIN`, and for AI the provider
   key **plus** its account RPM/TPM (AI stays off in production until the limits are set).
5. Deploy. The build type-checks and builds the web app, then installs the Python
   requirements with hash checking; the image runs as a non-root user.

## 3. First checks (in this order)

| Check | Expect |
|---|---|
| `GET /api/v1/health` | `{"status":"ok"}` |
| `GET /api/v1/health/ready` | `"database":"ok"`, and `ok` for each configured provider |
| Response headers on `/` | `content-security-policy`, `x-content-type-options: nosniff`, `x-frame-options: DENY` |
| `GET /api/v1/ai/status` | sets the `tdv` cookie with `Secure; HttpOnly; SameSite=Lax` |
| Landing → *Start planning* → finish the wizard | Overview shows your typed values, no "Live check unavailable" notice |
| One AI suggestion from the AI plan tab | items appear; logs show `ai_suggest … outcome: ready` |

If `ai_suggest` shows `category: billing`, the provider account has no credits or hit its
spending limit; the app fails over to the next provider and pauses the failing one.

## 4. Cold starts (what visitors notice)

- **Render Free sleeps** a service after a period without traffic (about 15 minutes). The next
  visit waits for the container to boot: typically 30–60 seconds, during which the browser
  shows Render's loading page. Afterwards the app is fast until it sleeps again.
- **Neon Free suspends** idle compute after a few minutes. The first query wakes it, usually
  in under a few seconds. The app handles this:
  - startup migrations retry the connection for about a minute instead of crash-looping;
  - the liveness check (`/api/v1/health`) never touches the database, so a sleeping database
    does not mark the container unhealthy;
  - the browser keeps working while the backend is cold: plans load from IndexedDB, budget
    figures fall back to the device calculation with "Live check unavailable. Showing figures
    calculated on this device.", and AI shows "AI suggestions aren't available right now."
- In-memory state resets on every restart: the per-IP API limit, the provider token bucket,
  circuit breakers and "provider paused after 401/403". The daily AI counters and spend cap
  are in Postgres and survive restarts.
- Without `SESSION_SECRET` the device cookie would change on every restart; production refuses
  to start without it, so the per-device daily limit stays correct across cold starts.

## 5. Updating and rolling back

- Push to `main` → CI (backend, web, e2e, docker) → Render auto-deploys the new image.
- Migrations are forward-only and run before the new version serves traffic. For a rollback,
  redeploy the previous image in Render; a new migration should stay backward compatible for
  one release so the previous image still runs.

## 6. Costs to watch

- Render Free and Neon Free: no charge within their limits.
- AI: the server enforces `AI_DAILY_SPEND_LIMIT_USD` (default $2.00) using the configured list
  prices, plus per-device, per-IP and global daily limits. Measured on 2026-11-01 through the
  real UI (Groq `openai/gpt-oss-120b`): `plan.generate` ≈ $0.0021, `menu.suggest` ≈ $0.0007,
  `schedule.draft` ≈ $0.0004 at list price (free tier: $0).
