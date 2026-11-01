# Implementation Plan

Project: Celebration & Event Planner (temporary name). Order follows the dependency chain in ARCHITECTURE.md: foundations, domain engines, API, UI, AI, hardening.

## Phases

| Phase | Tasks | Deliverables | Gate & Status |
|---|---|---|---|
| **Phase 1A: Navigation and Auth Wiring** | Update routes in `App.tsx`; `/login` and `/register` route to `/events/new`; `Header` and `MobileDrawer` dynamically route "Start planning" to `/events/new` or `/events`; "My plans" link displayed only when plans exist; account links removed from `Footer`; storage FAQ item added to `FAQSection`. | Guest-first navigation, no mandatory login | **COMPLETED & VERIFIED** |
| **Phase 1B: Local Data Layer** | Implement IndexedDB `toranly` DB (`plans`, `snapshots`, `meta`) via `idb`; in-memory storage fallback (`isInMemoryStorage`); automatic snapshotting (max 3); `StorageNoticeDialog` (D-15); `InMemoryBanner` (ST-07); `AutosaveStatus`; `ImportConflictDialog` (D-16); `exportPlanBackup` and `parseBackupFile` (2MB limit). | Resilient client storage & backup system | **COMPLETED & VERIFIED** |
| **Phase 1C: Deterministic Domain Logic** | Implement `money.ts` (Hamilton-Hare largest-remainder split, INR formatting); `budget.ts` (committed = max(planned, quoted, paid), status thresholds); `timeline.ts` (date offsets, preview date changes, Kahn's cycle detection, completion gating); `quotes.ts` (per-guest normalisation & cheapest flag); `guests.ts` (diet sum & coverage); `schedule.ts` (overlap detection); `export.ts` (CSV with formula injection escaping). | Pure domain calculations & Vitest suite (25/25 passing) | **COMPLETED & VERIFIED** |
| **Phase 1D: Planner Screens & Navigation** | Update `EventsDashboardPage.tsx` (`/events`) with backup download, D-01 delete confirmation, and D-16 import; update `EventWizardPage.tsx` with autosave; enhance `EventOverviewPage.tsx` with all tabs: Overview, Budget, Timeline, Vendors, Guests, Schedule, Ideas, AI Plan, Settings. | Full local celebration planner | **COMPLETED & VERIFIED** |
| **Phase 2: Print View & CSV Export** | Build `PrintPlanPage.tsx` (`/events/:id/print`) with A4 `@media print` layout omitting empty sections; integrate client-side "Download budget CSV" and "Download tasks CSV" buttons. | A4 print planner and CSV downloads | **COMPLETED & VERIFIED** |
| **Phase 3: Guest-first Python backend** | `backend/`: stateless FastAPI; `/api/v1/health`, `/plan/{template,summary,date-preview,validate}`, `/ai/{status,suggest}`; signed device cookie, IP hashing, Origin check, security headers; five AI limit layers with spend cap; xAI via Responses API (strict JSON schema); guards and template fallback; three usage tables; parity fixtures with the web engines; minimal web wiring (Vite proxy, AI tab with consent). | Stateless AI companion, no accounts | **IMPLEMENTED & TESTED LOCALLY**: 298 backend tests; xAI primary with automatic Groq fallback, web checks clean. Open before production: live smoke test with the real key, Docker build, Render deploy, verify `TRUSTED_PROXY_CIDRS`. |
| **Full-stack wiring (Nov 2026)** | One typed API client with generated OpenAPI types; screens use `/plan/template`, `/plan/summary`, `/plan/date-preview` and `/plan/validate` with an honest device fallback; fake data, fake AI and the demo AI tab removed; real AI plan tab (warning, usage meter, consent, accept, reject with undo, apply with confirmation, last 5 results kept); offline banner, page titles, lazy routes, accessibility and responsive fixes; Playwright E2E against the real backend; production image with a health check, safe startup migrations and GZip; DEPLOYMENT.md. | User-ready app, prepared for deploy | **IMPLEMENTED & TESTED LOCALLY** (TESTING.md section 9). Open: Docker build, Render and Neon deploy (needs approval), xAI credits, verify `TRUSTED_PROXY_CIDRS`. |
| **Phase 4 (later): Optional sync** | Accounts, server-side plan storage, revisions (API.md §2, DATABASE.md §2 to §9). | Multi-device sync | Not started |

Recommended first milestone: P0 plus the budget engine from P1. It retires the riskiest unknowns (xAI request shape, Render Docker runtime, font licences) and delivers the core differentiator (exact, tested budget arithmetic) before any UI work.

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| xAI rejects `text.format` on Responses API | AI blocked | Chat Completions `response_format` adapter (AI_SCHEMAS.md §1) |
| Render free plan changes or asks for a card | Hosting blocked | Koyeb backup; Cloud Run only with existing billing account |
| Cold starts during judging | Poor first impression | Warm up 2 minutes before demo |
| Neon limits reached | Downtime until next month | Monitor; small demo data |
| Scope creep | Late delivery | Deferred list in RR §1.4 is binding for MVP |

## Definition of done

TESTING.md §7 release gate passes on the deployed instance, and this document's audit has no open blocking items.

## Documentation audit (performed 26 Oct 2026)

Method: a script listed every requirement id, endpoint id, screen id, dialog id and test id across all files, checked that each referenced id is defined, checked relative links resolve, and searched for the old working name. Manual review covered the 18 checks in the brief. Results:

| # | Check | Result |
|---|---|---|
| 1 | PRD features in UX flows | Pass: F1 to F8 map to S-05 to S-14 |
| 2 | Every screen action has an outcome | Pass for listed actions; see open item O-3 |
| 3 | Backend operations have API contracts | Pass: E-01 to E-80 |
| 4 | API maps to services and tables | Pass: ARCHITECTURE.md §3 services, DATABASE.md tables |
| 5 | Every entity has a purpose | Pass: DATABASE.md §2 |
| 6 | AI features have input, output, validation | Pass: 9 contracts in AI_SCHEMAS.md §3 to §5 |
| 7 | Error states have recovery | Pass: UX_FLOWS.md §2, AI_SAFETY.md §6 |
| 8 | Buttons and nav items have behaviour | Pass: navigation matrix N-01 to N-20 and screen specs |
| 9 | Design tokens consistent | Pass: screens reference token roles only |
| 10 | Fonts and icons licensing | Partial: Lucide verified; Fraunces and Plus Jakarta Sans licence text unverified (O-1) |
| 11 | Budget arithmetic deterministic and testable | Pass: ARCHITECTURE.md §4, T-BUD |
| 12 | Vendor prices not shown as facts | Pass: AI_SCHEMAS.md has no vendor-name fields; "Estimate" labels |
| 13 | Free-tier claims sourced | Pass for Neon and Render (official); Cloud Run billing (official); Neon restore window unverified (O-2) |
| 14 | No undocumented paid dependency | Pass: xAI optional and documented |
| 15 | No secrets in files | Pass: `.env.example` has placeholders only |
| 16 | Plan follows dependency order | Pass |
| 17 | Links and filenames valid | Pass: script found 16 files, 0 broken relative links, 0 undefined FR, E, S, D, N, T or J ids, 0 occurrences of the old working name |
| 18 | No contradictions or duplicates | Pass after fixes made during the audit (listed below) |

Fixes made during the audit: removed `guest_summaries` from the AI apply targets (AI never writes guests); added the idea form dialog D-14; added `APP_DISPLAY_NAME` to configuration.

Open items:

| ID | Item | Blocking |
|---|---|---|
| O-1 | Confirm OFL licence files for Fraunces and Plus Jakarta Sans and `tnum` availability (P0-3) | Before P3 |
| O-2 | Confirm Neon restore window and region list | No |
| O-3 | Copy text for all empty and error states needs a writing pass with real users | No |
| O-4 | xAI structured-output parameter, `store` option, usage policy (P0-4). Shape and `store` confirmed in docs on 2026-10-28; live smoke test still to run | Before enabling AI in production |
| O-5 | Aisle Planner, ShaadiSaga, Eventbrite not researched | No |
| O-6 | Colour emotion and cultural associations unverified; preference test P5-4 | No |
| O-7 | Hindi UI strings deferred; font stack ready | No |
