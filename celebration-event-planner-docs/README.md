# Toranly — Celebration & Event Planner

Status: **Guest-First Planning (Option C) Implemented & Verified**.

## What it is

A modern planning workspace for weddings, engagements, birthdays, anniversaries, community events and family celebrations in India. It keeps an INR budget that always adds up, a timeline tied to the event date, vendors and quotes, guest and dietary counts, and a day-of schedule.

Under **Guest-First Planning (Option C)**:
- **No mandatory login**: Visitors jump straight into planning from the landing page via the 4-step wizard (`/events/new`) or directly open My Plans (`/events`) if plans exist on the device.
- **Local browser persistence**: Plans, automatic snapshots (last 3 versions), and metadata are safely saved in browser IndexedDB (`toranly` DB) via `idb`, with an in-memory fallback if storage is restricted.
- **Full deterministic domain engine**: Hamilton-Hare largest-remainder money splits, committed/remaining budget math (max of planned, quoted, paid), timeline offsets, Kahn's dependency cycle detection, quote normalisation, dietary coverage checks, schedule overlap detection, and CSV formula injection escaping.
- **A4 Print planner (`/events/:id/print`)**: Clean, ink-friendly `@media print` layout omitting empty sections and designed for A4 paper or PDF export.
- **Client-side exports**: Budget CSV and Task checklist CSV downloads with Excel formula escaping (`= + - @` prefixed with `'`).
- **Backup & restore**: Validated `.toranly.json` files (max 2MB, Zod schema validation, D-16 conflict detection).
- **Privacy & security**: Zero AI API keys in frontend code or client builds. Personal notes and guest PII are never sent to external services.

## Verification & Commands

Inside `web/`:
```bash
npm run typecheck    # Strict TypeScript verification (0 errors)
npm run lint         # ESLint check (0 errors, 0 warnings)
npm run test         # Vitest unit test suite (25/25 passing)
npm run build        # Production bundle build
```

## Key features (MVP)

- Event setup wizard with ready-made budget split and checklist per event type
- Budget categories, expenses and overspend warnings computed in the browser (TypeScript); the optional backend has Python reference endpoints that give the same results (parity-tested)
- Timeline with dependencies and safe date changes
- Vendors, quotes and quote comparison per guest
- Guest diet counts with menu coverage check
- Day-of schedule per function with overlap checks
- Optional AI suggestions through the backend (review only for now; accept, reject and revise are planned); everything works without AI
- CSV export

Full scope: [PRD.md](PRD.md).

## Architecture summary

Plans live in the browser. A stateless FastAPI backend (`backend/`) serves the built React app on the same origin, offers Python reference endpoints and AI suggestions, calls xAI from the server only, and stores nothing but AI usage counters in Postgres. Details: [ARCHITECTURE.md](ARCHITECTURE.md) §8 and [../backend/README.md](../backend/README.md).

## Documentation map

| Document | Contents |
|---|---|
| [RESEARCH_REPORT.md](RESEARCH_REPORT.md) | Evidence, comparisons, references, open gaps |
| [PRD.md](PRD.md) | Requirements and acceptance |
| [TRD.md](TRD.md) | Stack, versions, configuration |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Components, data flow, deployment |
| [API.md](API.md) | Endpoints and contracts |
| [AI_SCHEMAS.md](AI_SCHEMAS.md) | AI input and output models |
| [AI_SAFETY.md](AI_SAFETY.md) | AI risks and controls |
| [SECURITY.md](SECURITY.md) | Threat model and baseline |
| [DATABASE.md](DATABASE.md) | Tables and rules |
| [UX_FLOWS.md](UX_FLOWS.md) | Screens, navigation, states |
| [ACCESSIBILITY.md](ACCESSIBILITY.md) | WCAG 2.2 AA requirements |
| [design/DESIGN_SYSTEM.md](design/DESIGN_SYSTEM.md) | Colour, type, icons, components, motion |
| [TESTING.md](TESTING.md) | Test plan and release gate |
| [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) | Phases and audit |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Conventions |

## Prerequisites (for implementation)

- Python 3.14, Node.js LTS, Docker (for local Postgres and the production image)
- A Neon account (free plan) for hosted Postgres
- Optional: an xAI API key. Without it, AI features show the standard template fallback

## Setup (planned commands; repository not scaffolded yet)

```bash
cp .env.example .env                 # fill DATABASE_URL, SESSION_SECRET, optional XAI_API_KEY
docker compose up -d db              # local Postgres
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.lock
alembic upgrade head
uvicorn app.main:app --reload        # API on :8000
npm --prefix web ci && npm --prefix web run dev   # web on :5173, proxies /api to :8000
```

Environment variables: [TRD.md](TRD.md) §6. All are server-side only.

## Testing

Commands and gates: [TESTING.md](TESTING.md) §4 and §7.

## Deployment overview

Docker image on Render Free (web service), database on Neon Free, CI on GitHub Actions. Free tiers sleep when idle: expect about a minute for the first request after inactivity. See [ARCHITECTURE.md](ARCHITECTURE.md) §7.
