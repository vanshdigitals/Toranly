# Testing

Project: Celebration & Event Planner (temporary name). Vitest domain & storage unit tests implemented and passing.
Related: [PRD.md](PRD.md), [API.md](API.md), [AI_SCHEMAS.md](AI_SCHEMAS.md), [ACCESSIBILITY.md](ACCESSIBILITY.md).

## 1. Layers

| ID | Layer | Tool | Scope | Status |
|---|---|---|---|---|
| T-FE-UNIT | Frontend Domain Unit Tests | Vitest | `web/src/domain/__tests__/domain.test.ts` (Largest-remainder split, INR formatting, budget status thresholds, date offsets, Kahn cycle detection, task completion gating, quote comparison, diet validation, schedule overlap, CSV formula escaping) | **PASSED** (17/17 tests) |
| T-FE-STORE | Local Storage & Backup Tests | Vitest + fake-indexeddb | `web/src/storage/__tests__/storage.test.ts` (IndexedDB plan save/get/delete, snapshot capping at 3, snapshot restore, backup export, Zod parsing & validation, conflict detection) | **PASSED** (8/8 tests) |
| T-FE-DATE | Date formatting & settings | Vitest | `web/src/domain/__tests__/dateFormatAndSettings.test.ts` | **PASSED** (7/7 tests, 2026-10-29) |
| T-FE-PARITY | Parity with the Python engines | Vitest | `web/src/domain/__tests__/parity.test.ts` reads `backend/tests/parity/fixtures/*.json` | **PASSED** (38 + 2 expected failures for documented divergences, §8) |
| T-TYPE | TypeScript Type Checking | tsc -b | `web/src/` strict type checking with `verbatimModuleSyntax` | **PASSED** (0 errors) |
| T-LINT | Code Quality & Style | ESLint | `web/` linting with React Hooks and TypeScript rules | **PASSED** (0 errors, 0 warnings) |
| T-BUILD | Production Bundle Build | Vite | `web/` build output with secret key verification (`XAI_API_KEY` absence check) | **PASSED** (Clean bundle) |
| T-UNIT | Backend domain unit tests | pytest, hypothesis | `backend/tests/unit` (paise split incl. property test, thresholds 89.9/90/100/100.1%, exact-90% rule, dates across month ends and leap years, cycles, gating, quotes, diets, schedule overlaps and windows, templates) | **PASSED** 35 |
| T-BUD | Budget calculations | pytest, hypothesis | split sums to total; committed rule; status thresholds 89.9/90/100/100.1%; zero allocation |
| T-DATE | Dates and timezones | pytest | offsets across month ends, leap day 2028-02-29, event today, past dates rejected, Asia/Kolkata vs other user timezones, fixed vs relative tasks |
| T-DEP | Dependencies | pytest | cycle detection, gating complete, deleting a prerequisite |
| T-QUOTE | Quote comparison | pytest | per plate vs total, missing units rejected, expired quotes flagged |
| T-GST | Guests | pytest | diet sum > total rejected; coverage computed |
| T-SCH | Schedule | pytest | overlaps, outside window |
| T-SCHEMA | Pydantic schemas | pytest | API and AI models reject extra fields, bounds, enums; JSON Schema subset check for xAI |
| T-AI | AI orchestration with fakes | pytest with a fake provider | valid output; invalid JSON then repair success; repair failure then fallback; refusal; 429 with Retry-After; timeout; 401 disables AI; injection text in notes; guards strip URLs/phones; no writes without apply |
| T-AI-SMOKE | Live xAI smoke test | pytest marker `live`, manual or nightly with key | `text.format` accepted by the configured model; usage tokens returned; one call per contract; cost logged. Must pass before AI is enabled in production |
| T-DB-01 | DB integration | pytest with Postgres in Docker (CI service) | repositories, constraints, cascades, transactions |
| T-DB-02 | Migrations | pytest | upgrade head and downgrade base on empty DB |
| T-API | API contract | pytest + FastAPI TestClient | each endpoint E-01 to E-80: success, validation, 401, 403 CSRF, 404 ownership, Problem Details shape; OpenAPI snapshot diff |
| T-SEC-01 | Authorization | pytest | user B receives 404 on every user A resource id across all endpoints (parametrised) |
| T-SEC-02 | Security headers and limits | pytest | CSP, cookie flags, 413 on large body, login rate limit |
| T-FE | Frontend components | Vitest + Testing Library | Money formatting (₹12,34,567; compact L and Cr), forms, error mapping, status chips |
| T-NAV | Navigation | Playwright | matrix rows N-01 to N-20 |
| T-E2E | Journeys | Playwright | J-01 to J-06 (§5) |
| T-A11Y | Accessibility | @axe-core/playwright, manual | every screen and dialog; keyboard script; screen reader checklist |
| T-VIS | Visual regression | Playwright screenshots | S-04, S-06, S-07, S-10 at 375px and 1280px |
| T-BUILD | Static checks | Ruff, mypy, ESLint, tsc, Prettier | must be clean |

## 2. Fixtures

- `tests/fixtures/events.py`: factories for a wedding (3 functions, 11 categories, 40 tasks), a birthday and a community event, with fixed `today` via an injectable clock.
- `tests/ai/recorded/`: JSON outputs per contract (valid, invalid, refusal, injection-influenced). Recorded from the smoke test, then scrubbed.
- Money fixtures in paise only.

## 3. Mocking strategy

- The `Provider` protocol is replaced by `FakeProvider` returning fixture outputs or raising mapped errors. No network in default test runs.
- Clock injected (`core/clock.py`) so date tests are deterministic.
- Playwright E2E runs against the real backend with `XAI_API_KEY` empty plus a test-only fake provider enabled by `APP_ENV=test`.

## 4. Commands

```bash
# backend
ruff check . && ruff format --check . && mypy app
pytest -m "not live"
pytest -m live            # needs XAI_API_KEY; costs money
# frontend
npm --prefix web run lint && npm --prefix web run typecheck && npm --prefix web test
npx playwright test
```

## 5. Principal journeys (acceptance)

| ID | Journey | Pass criteria |
|---|---|---|
| J-01 | Register, create birthday via wizard, reach overview | Categories sum to budget; tasks have due dates; under 3 min scripted |
| J-02 | Generate plan, accept 3 items, reject 1, apply | Only accepted items written; audit row; undo reject works |
| J-03 | Change event date | Preview matches result; relative tasks moved; fixed tasks kept |
| J-04 | Add expenses until a category is over | Status "Over" with icon and text; announcement fired |
| J-05 | Add vendors and quotes, compare, delete vendor | Lowest marked; expenses kept unlinked |
| J-06 | Offline and 500 handling | Banner, disabled saves, Retry recovers |

## 6. Requirement traceability

| Requirement | Tests |
|---|---|
| FR-AUTH-01 to 04 | T-API, T-SEC-02, T-E2E J-01 |
| FR-EVT-01, 02, 03, 06 | T-API, T-NAV, J-01 |
| FR-EVT-04 | T-DATE, T-API, J-03 |
| FR-EVT-05 | T-API, T-DB-01 |
| FR-EVT-07 | T-UNIT (templates), T-BUD, J-01 |
| FR-BUD-01 to 05 | T-BUD, T-API, T-FE, J-04 |
| FR-TSK-01 to 05 | T-DEP, T-DATE, T-API, T-NAV |
| FR-VEN-01 to 04 | T-QUOTE, T-API, J-05 |
| FR-GST-01, 02 | T-GST, T-API |
| FR-SCH-01, 02 | T-SCH, T-API |
| FR-IDEA-01 | T-API |
| FR-AI-01 to 08 | T-AI, T-AI-SMOKE, T-SCHEMA, J-02 |
| FR-EXP-01 | T-API (CSV content, formula-injection escaping) |
| NFR-01 | T-A11Y |
| NFR-04 | T-BUD (hypothesis), Ruff rule banning float in `domain/money.py` |
| NFR-05 | T-SEC-01 |
| NFR-10 | T-AI (asserts PlanContext fields) |

## 7. Release gate (definition of done for the MVP)

1. T-BUILD clean.
2. All non-live tests pass in CI.
3. T-AI-SMOKE passed within the last 7 days with the production model id, or AI disabled (`XAI_API_KEY` empty).
4. Zero serious or critical axe violations; manual keyboard and screen reader checklists signed off.
5. `pip-audit` and `npm audit` show no high or critical issues.
6. Journeys J-01 to J-06 pass on the deployed instance.
7. The fallback path is demonstrated with the AI key removed.

## 8. Backend tests (Phase 3, implemented)

Run on 2026-10-28 (Windows, Python 3.14.6, Postgres 16.2 local):

| Suite | Path | What it covers | Result |
|---|---|---|---|
| Unit | `backend/tests/unit` | domain engines (see T-UNIT) | 35 passed |
| API and security | `backend/tests/api` | plan endpoints and bounds; tampered and missing cookie; cookie flags; only hashes stored; Origin 403; 413 (declared and chunked); security headers on every response; HSTS and no `/docs` in production; 500 without internals; no input echo; CORS allowlist; per-IP limit; trusted-proxy IP; unsafe production config refused; XAI key never in responses or logs; `web/dist` scan; SPA serving and path traversal | 47 passed |
| Prompt snapshots | `backend/tests/ai/test_prompts.py` | system prompt, rendered user block and xAI schema per contract compared with `tests/ai/snapshots/*.v1.txt`; safety rules present in the system prompt | 12 passed (included in the AI count) |
| AI | `backend/tests/ai` | contract models reject extra fields and out-of-range values; JSON Schema fits the xAI subset; FakeProvider: valid, invalid then repaired, repair fails then fallback/failed, refusal, 429 with Retry-After, 429 too long, timeout, total budget, 401 disables AI, circuit breaker, injection in feedback treated as data, guards strip URLs/emails/phones and drop booking claims and unlisted customs, PlanContext never carries notes/names/contacts, bucket-empty retry regression; prompt snapshots | 103 passed |
| Database | `backend/tests/db` | each limit layer at the right count (device minute, device day, IP day, global day, spend cap), provider bucket 503 with reservation released, concurrency semaphore, 20 parallel requests counted exactly, rollback of earlier layers, extend/finalize/release, cleanup of rows over 30 days, migration upgrade/downgrade, readiness | 14 passed |
| Parity | `backend/tests/parity` + `web/src/domain/__tests__/parity.test.ts` | 39 shared fixtures run through Python and TypeScript | pytest 40 passed; Vitest 38 passed + 2 expected failures |
| Failover | `backend/tests/ai/test_failover.py`, `test_adapters.py` | xAI success without Groq; xAI timeout, billing, rate limit, server error, bad key then Groq; Groq bad key; both down; missing primary, fallback or both keys; no failover on refusal, content policy or our 422; bounded calls; one generation counted across failover; spend cap stops failover; Groq output validated and guarded; secrets redacted; request shapes and error classification over mocked HTTP; Groq schema subset; Groq TPM 429 with a billing link is a rate limit | 51 passed (2026-10-29) |
| Live smoke | `uv run python -m scripts.ai_smoke --live` (one small call per provider) and `backend/tests/ai/test_live_smoke.py` (marker `live`, every contract for xAI and Groq) | real calls; never in CI | **Groq: passed, all 9 contracts** (2026-10-29, `openai/gpt-oss-120b`, paced by the provider guard, about $0.007 in total). **xAI: not passed.** The first run was rejected with 400 "Incorrect API key provided" (a Groq key was configured); with an `xai-` key the smoke call got 403 billing (no credits or spending limit reached). The xAI request shape is still unverified |

Total `pytest -m "not live"`: 299 tests. Last full run with Postgres: 298 passed (2026-10-29). After the Groq rate-limit classification fix: 285 passed and the 14 Postgres tests skipped because the local database was not running; that change does not touch the database code. Ruff check, Ruff format check and mypy (strict on `app/domain` and `app/ai`): clean. `pip-audit`: no known vulnerabilities. Web: typecheck, ESLint and build clean; Vitest 70 passed + 2 expected failures. Docker build: not run (Docker is not installed on the build machine); CI builds the image.

### TypeScript divergences (resolved Nov 2026)

Both were fixed in TypeScript, because the Python engine is the reference: the 90% warning threshold is now exact in integer paise (`committed * 10 >= allocated * 9`), and `guests.ts` accepts the `non_veg` tag. Parity: pytest 40 passed, Vitest 40 passed, no expected failures.

Also noted, not covered by a fixture: `calculateDueDate` uses `Date` with local-time `setDate`, which can be off by a day in time zones with daylight saving; the Vitest run happened in IST, where it is correct. `previewDateChange` has no `shiftFixedTasks` option (the Python engine and API do).

## 9. Full-stack verification (Nov 2026)

Run on 2026-11-01 (Windows, Python 3.14, local Postgres via `pgserver`, Chrome).

| Suite | Command | Result |
|---|---|---|
| Backend | `uv run ruff check . && uv run ruff format --check . && uv run mypy && uv run pytest -m "not live"` | clean; **311 passed**, 18 live tests deselected |
| Web unit | `npm run typecheck && npm run lint && npm test` | clean; **102 passed** (10 files), including the API client, the AI apply logic and the AI privacy test |
| API types | `npm run api:types:check` | in sync with `web/openapi.json` |
| End to end | `npm run e2e` (Playwright; real FastAPI and Postgres serving the production build; `APP_ENV=test`, `AI_FAKE_PROVIDER=true`) | **8 passed** (E2E-1 to E2E-8, `web/e2e/planner.e2e.ts`) |
| Accessibility | axe-core 4 on 14 screens at 1280 px | 0 critical, 0 serious (9 moderate, 1 minor remain) |
| Responsive | 14 screens at 360, 390, 768, 1024, 1280, 1440 and 1920 px | no horizontal scrolling |
| Lighthouse 12 | production build served by FastAPI, mobile emulation | Landing 80 / 100 / 100 / 100 (performance / accessibility / best practices / SEO); My Plans 92 / 100 / 93 / 100 (measured before the CSP console fix) |
| Live smoke (UI) | three generations through the real AI plan tab | `plan.generate`, `menu.suggest`, `schedule.draft`: all `ready` via Groq after xAI 403 (no credits); tokens in/out 1,772/3,079, 1,063/871, 986/363; est. $0.0021, $0.0007, $0.0004 at list price |
| Docker build | `docker build -f backend/Dockerfile .` | **not run** (Docker is not installed locally); CI builds the image |

E2E notes: E2E-5 forces the busy path with the theme word `e2e-busy` (the fixture provider answers 429, the orchestrator returns 503 with Retry-After). E2E-6 simulates a stopped backend by failing every `/api/v1` request in the browser.
