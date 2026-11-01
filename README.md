# Toranly

**A celebration planner that tells Indian families what to do next, why, and how much is left, with AI ideas they approve, and no sign-up.**

<!-- CI badge: added once the repository is on GitHub (owner/repo needed for the URL). -->

![Toranly Overview: Next best actions worked out from the plan](celebration-event-planner-docs/assets/overview.webp)

Live demo: not deployed yet (deployment guide: [DEPLOYMENT.md](celebration-event-planner-docs/DEPLOYMENT.md)).

---

## 1. Chosen vertical

**Challenge 5: Celebration & Event Planner.**

Persona: families in India planning weddings, engagements, birthdays, anniversaries, community
and family events, including relatives who are not comfortable with technology (a grandparent
helping with a wedding, a parent planning a birthday on a phone).

## 2. The problem

- **Scattered budgets.** Spends live in chats and notebooks; nobody knows which category is over.
- **Missed tasks.** Lead times (venue, photographer, caterer) are easy to miss until it is too late.
- **Hard-to-compare quotes.** One caterer quotes per plate, another a total; they are not comparable.
- **Mixed diets.** Veg, non-veg, Jain, eggetarian and vegan guests at one event; menus miss groups.

## 3. Approach and logic

### A deterministic planning engine (Python, the reference)

All planning decisions are plain, tested Python in `backend/app/domain/` (pure functions, no
I/O, no AI). The browser has a TypeScript twin for instant previews and offline use; shared
fixtures prove both give the same answers (parity tests).

### Decisions made from the user's context

| # | Context | Decision | Example |
|---|---|---|---|
| 1 | Event type | Its own budget categories, percentage split and starter checklist | A wedding gets Venue & Stays, Catering & Dining, Decor & Mandap…; a birthday gets Party Venue, Catering & Beverages, Custom Cake & Treats… |
| 2 | Event date | Task due dates counted back from the date; overdue detection; a preview before moving the date | Moving the date by +31 days shows which tasks shift and which become overdue |
| 3 | Days left | A task whose usual lead time is longer than the days left is **Urgent** and suggested first | "Usually done 70 days before the event; only 24 days left." |
| 4 | Budget and spending | Warning at 90%, over budget above 100% (exact integer maths), per category and overall; when a category is over, the category with the most room is named | "Over by ₹50,000. Catering & Dining still has ₹3,75,000 unspent; move some of it here." |
| 5 | Guests and diets | Menu coverage per diet group; quotes compared per guest | "12 Jain guests have no dish on the menu yet." |
| 6 | Schedule | Overlaps and items outside a function's hours | "1 pair of items overlap in Sangeet." |
| 7 | Preferences | Theme words, customs and colours to avoid that the user chose go to AI suggestions; nothing is inferred from names | Theme "Marigold" shapes decor ideas |
| 8 | AI | Grok (xAI) adds ideas on top of the rules; nothing changes the plan until the user accepts | Accept 2, reject 1 → a confirmation lists the exact changes |

Rules 2–6 are combined into **Next best actions** (`POST /plan/summary`): up to five
suggestions ordered by urgency, milestones, dependencies and due dates, each with a one-line
reason. A task that waits for another points to that one first ("Finish 'Shortlist venues'
first"). Three task slots at most come first, so budget, menu and schedule problems are never
hidden.

### How AI fits in

- Suggestions only. Each item is labelled **Suggested** (or **Standard template** for the
  fallback), money values carry an **Estimate** chip, and accepted items keep the label **AI idea**.
- Privacy-safe context: event type, month, city, guest range, budget, diet counts and chosen
  preferences. **Never** notes, names, contact details or exact dates (enforced by tests in
  Python and TypeScript).
- The key stays on the server. xAI is primary; Groq is the automatic fallback.
- Limits per device, per IP and globally, plus a daily spend cap, enforced atomically in Postgres.

### Why guest-first

No sign-up, no password, no personal data on a server. Plans live in the browser (IndexedDB)
with automatic snapshots and a downloadable backup. The backend is stateless: it receives the
plan, calculates, and forgets it.

## 4. How it works

```mermaid
flowchart LR
  subgraph Browser
    UI[React app] --> IDB[(IndexedDB: plans, snapshots, AI results)]
    UI --> TS[TypeScript engines: instant preview, offline]
  end
  UI -- "/api/v1 (same origin, signed device cookie)" --> API[FastAPI routers]
  API --> SVC[services: plan use cases]
  SVC --> DOM[domain: pure planning engine]
  API --> ORCH[AI orchestrator: limits, validation, guards]
  ORCH --> XAI[xAI Grok]
  ORCH -. fallback .-> GROQ[Groq]
  ORCH --> PG[(Postgres: AI usage counters only)]
```

**Data flow.** The wizard builds a plan in the browser and asks the backend for the starter
template. Every edit is saved on the device at once; the Overview and Budget then show the
backend's figures from `/plan/summary` (debounced). If the backend cannot be reached, the app
keeps working and says "Live check unavailable. Showing figures calculated on this device.",
then retries every 15 seconds.

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/health`, `GET /api/v1/health/ready` | Liveness; readiness (database, provider states) |
| `POST /api/v1/plan/template` | Budget split and starter checklist for an event type and date |
| `POST /api/v1/plan/summary` | Budget totals and status, overdue tasks, diet coverage, task urgency, Next best actions |
| `POST /api/v1/plan/date-preview` | What a date change would do, before anything changes |
| `POST /api/v1/plan/validate` | Cross-field problems (dependency loops, diet totals, schedule, quotes); used before import and print |
| `GET /api/v1/ai/status` | AI available? Suggestions left today, reset time |
| `POST /api/v1/ai/suggest` | Validated suggestions for one of 9 contracts |

Errors are RFC 9457 Problem Details. API types for the web app are generated from the
backend's OpenAPI schema; CI fails if they drift. Full details: [API.md](celebration-event-planner-docs/API.md),
[ARCHITECTURE.md](celebration-event-planner-docs/ARCHITECTURE.md).

## 5. Features

- **Plan wizard** in 4 steps (type, date and city, budget and guests, preferences); starts empty.
- **My plans**: list, delete with confirmation, backup download, import with validation.
- **Overview**: countdown, budget at a glance, **Next best actions**, upcoming tasks, diet summary.
- **Budget**: categories with allocations, expenses (planned, quoted, paid), 90% and over-budget
  status with icon and text, rebalance hint, CSV export.
- **Timeline**: tasks with due dates, dependencies, milestones, **Urgent** / **Due soon** with the
  reason, filters, CSV export.
- **Vendors and quotes**: shortlist, book, compare quotes per guest.
- **Guests**: diet counts, allergies, accessibility needs.
- **Schedule**: functions and day-of items with overlap detection.
- **Ideas**: theme, decor, menu and saving ideas, plus AI ideas you accept.
- **AI plan**: 8 suggestion types, usage meter, consent, accept/reject with undo, confirm before
  applying, last 5 results kept, revise with feedback.
- **Settings**: event details, date change with preview, functions, **Text size**, backup and
  restore, CSV, delete.
- **Print / PDF** view (A4), offline banner, page titles, 404 page, error recovery.

## 6. Quality evidence

**Security**
- Keys only in the backend environment; CI fails if a key or provider URL reaches `web/` or the build.
- Every endpoint validated with Pydantic (`extra="forbid"`, length and range limits); 64 KB body limit.
- Origin check on POST, signed HttpOnly device cookie, CSP, HSTS (production), nosniff,
  Referrer-Policy, frame-ancestors, Permissions-Policy; `/docs` off in production; non-root Docker user.
- AI output schema-validated and filtered; prompt injection in user text is treated as data (tested).
- `pip-audit` and `npm audit --omit=dev`: no known vulnerabilities. Details: [SECURITY.md](SECURITY.md).

**Efficiency**
- Stateless API; domain functions are linear or `n log n` (budget summary in one pass over
  expenses; schedule overlaps by sweep line, proven equal to the pairwise check by a property test).
- Postgres pooling with `pool_pre_ping`; AI calls have timeouts, a concurrency limit and an output-token cap.
- Initial JavaScript **128 kB gzip**; heavy tabs (AI plan, Settings, Ideas, Schedule, Guests),
  the print view and the mobile menu load on demand; GZip on every response.
- Lighthouse (mobile): landing **90 / 100 / 100 / 100**, Overview with a real plan
  **100 / 100 / 100 / 100** (performance / accessibility / best practices / SEO; Overview measured
  with a warm cache).

**Testing**
- Backend: **337 tests** (pytest), coverage **95%** overall, **99%** on `domain/`, **95%** on `ai/`;
  CI fails below 80% on `domain/` and `ai/`.
- Web: **116 unit tests** (Vitest), including parity fixtures shared with Python, storage with
  fake IndexedDB, backup validation and the AI privacy test.
- **9 Playwright tests** against the real backend and Postgres (AI from recorded fixtures):
  wizard to Overview, overspend, date change, AI accept/reject/apply, limits and busy, offline,
  backup/import, refresh on every route, and axe on 14 screens.

**Accessibility**
- axe-core: **0 serious or critical issues** on all 14 screens (automated in CI).
- **Text size** setting (Standard / Large / Extra large) scales every font; layouts checked at
  360–1280 px with Extra large text; 17 px body text on phones.
- Labels on every control, visible focus ring, skip link, landmarks, live regions for saves and
  status, icon + text for every status, 44 px or larger targets on the new controls
  (Next best actions, Text size, carousel buttons).
- Reduced motion respected; the landing carousel has a Pause button.

## 7. Tech stack

| Layer | Technology |
|---|---|
| Web | React 19, TypeScript 5.8, Vite 6, React Router 7, Zod 4, idb 8, lucide-react |
| Backend | Python 3.14, FastAPI 0.162, Pydantic 2.14, SQLAlchemy 2.1, Alembic 1.20, Uvicorn 0.54 |
| AI | xAI Grok (`grok-4.3`, Responses API, strict JSON schema), Groq fallback (`openai/gpt-oss-120b`) via the OpenAI SDK |
| Data | IndexedDB in the browser; Postgres 17 for AI usage counters only |
| Quality | pytest 9, Hypothesis, Ruff, mypy; Vitest 5, ESLint, Prettier, Playwright 1.64, axe-core |
| Delivery | One Docker image (web build served by FastAPI); GitHub Actions CI |

## 8. Run locally

**Prerequisites:** Node 24, Python 3.14 with [uv](https://docs.astral.sh/uv/), Postgres 17
(`docker compose -f backend/docker-compose.yml up -d`, or any local Postgres).

```bash
npm run setup                                # web dependencies + backend virtualenv
cp backend/.env.example backend/.env         # then set DATABASE_URL (and keys, optional)
uv run --directory backend alembic upgrade head
npm run dev:api                              # FastAPI on :8000
npm run dev:web                              # Vite on :5173 (proxies /api to :8000)
```

**AI is optional.** Without a key the planner works fully; the AI plan tab says suggestions are
not available. To enable it, put your key in `backend/.env` only (`XAI_API_KEY`, or
`GROQ_API_KEY` for the fallback) with the account limits (`*_ACCOUNT_RPM`, `*_ACCOUNT_TPM`).
Never put keys in `web/` or in `VITE_*` variables.

**Tests and checks**

```bash
npm run lint && npm run typecheck            # Ruff, mypy, ESLint, tsc
npm test                                     # pytest (not live) + Vitest
npm run coverage                             # coverage for both
E2E_DATABASE_URL=postgresql+psycopg://toranly:toranly@127.0.0.1:5432/toranly npm run test:e2e
npm run test:all                             # everything above
```

## 9. Assumptions

- Money is in INR (stored in paise) with Indian digit grouping; dates are shown Indian style (14 Mar 2027).
- Budget split percentages are starting points; users can change every allocation.
- Plans are stored per browser; clearing site data removes them, so the app offers backups.
- AI suggestions can be wrong; they are labelled and never applied without confirmation.
- xAI and Groq limits and prices are as configured in `backend/.env`; the spend cap uses them.
- No accounts in this version (sign-in screens exist only behind a feature flag that is off).

## 10. Limitations and future work

- Optional accounts and sync across devices; server-side PDF; a Hindi interface.
- Changing the event date shifts tasks but not function dates.
- Rejected AI suggestions are not yet sent back as reasons when revising.
- The Budget tab component is still large (about 1,200 lines) and could be split further.
- The live xAI call needs an account with credits; Groq has been verified live through the UI.

## 11. Project structure

```
backend/                 FastAPI app
  app/api/               thin routers, request/response models, dependencies
  app/services/          plan use cases (compose the domain engines)
  app/domain/            pure planning engine: budget, timeline, insights, guests, quotes, schedule
  app/ai/                orchestrator, providers (xAI, Groq), contracts, guards, prompts
  app/core/              config, security middleware, rate limits, errors, logging
  app/db/                SQLAlchemy models, Alembic migrations
  tests/                 unit, api, ai, db, parity
web/                     React app
  src/pages/             routes; event-overview/ holds the planner hook and tabs
  src/components/        tabs, dialogs, shell
  src/domain/            TypeScript engines (preview and offline)
  src/storage/           IndexedDB, backup and import
  src/api/               typed client, generated OpenAPI types
  e2e/                   Playwright tests
celebration-event-planner-docs/   PRD, architecture, API, AI safety, testing, deployment
```

## 12. License

[MIT](LICENSE)
