# Toranly

Celebration and event planner for families in India. Plans live in your browser; an optional
stateless Python backend adds AI suggestions without storing your plan.

| Folder | What |
|---|---|
| `web/` | React + TypeScript app (IndexedDB storage, domain engines). See `web/README.md` |
| `backend/` | FastAPI companion: AI suggestions (xAI, Groq fallback), plan calculations, usage counters only. See `backend/README.md` |
| `celebration-event-planner-docs/` | Product and technical documentation |

## Run

```bash
# backend (needs Docker for Postgres, and uv)
cd backend && uv sync && docker compose up -d && cp .env.example .env
uv run alembic upgrade head
uv run uvicorn app.main:app_factory --factory --reload --port 8000

# web (another terminal; proxies /api to :8000)
npm --prefix web install && npm --prefix web run dev
```

Without an AI key everything works; the AI plan tab says AI suggestions aren't available. Without the backend
the planner still works on this device and says "Live check unavailable".

## Test

```bash
cd backend && uv run ruff check . && uv run mypy && uv run pytest -m "not live"
npm --prefix web run lint && npm --prefix web run typecheck && npm --prefix web test
# end to end: real backend + Postgres, recorded AI answers (no provider calls, no cost)
E2E_DATABASE_URL=postgresql+psycopg://toranly:toranly@127.0.0.1:5432/toranly npm --prefix web run e2e
```

Results and what each suite covers: `celebration-event-planner-docs/TESTING.md`.

## Deploy

One Docker image (`docker build -f backend/Dockerfile .` from this folder) serves the web app and
the API on the same origin. Step-by-step Render Free + Neon Free guide with cold-start notes:
`celebration-event-planner-docs/DEPLOYMENT.md`; every production variable: `backend/README.md`.
