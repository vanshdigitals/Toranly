# API Specification

Base path: `/api/v1`. Format: JSON (UTF-8). Served from the same origin as the web app (ARCHITECTURE.md §7).
Related: [DATABASE.md](DATABASE.md), [AI_SCHEMAS.md](AI_SCHEMAS.md), [UX_FLOWS.md](UX_FLOWS.md), [SECURITY.md](SECURITY.md).

> **Guest-First Architecture (Option C)**: plans live in the browser. The backend implemented in Phase 3 (`backend/`) is stateless for event data and exposes only the endpoints in §0. Sections §1 to §4 describe the earlier account-based API; they are kept as the plan for a later optional sync phase and are **not implemented**.

## 0. Implemented endpoints (Phase 3)

| Method and path | Purpose | Limits | Stores |
|---|---|---|---|
| GET /api/v1/health | Liveness | none | nothing |
| GET /api/v1/health/ready | Database reachable | none | nothing |
| POST /api/v1/plan/template | Template categories and starter tasks | 60/min per IP | nothing |
| POST /api/v1/plan/summary | Budget totals, per-category status, overdue tasks, diet coverage | 60/min per IP | nothing |
| POST /api/v1/plan/date-preview | Shifted, unchanged and now-overdue tasks for a new date | 60/min per IP | nothing |
| POST /api/v1/plan/validate | Validation problems (cycles, diet totals, schedule, quotes) | 60/min per IP | nothing |
| GET /api/v1/ai/status | Whether AI can be used now; sets the device cookie | 60/min per IP | nothing |
| POST /api/v1/ai/suggest | AI suggestions for one contract | layers in §0.4 | usage counters only |

There is no generic chat or prompt endpoint, no account endpoint and no endpoint that stores a plan.

### 0.1 Conventions

| Topic | Rule |
|---|---|
| Format | JSON, UTF-8. Plan endpoints use the web app's camelCase field names; AI items use the snake_case contract fields of AI_SCHEMAS.md §4 |
| Origin | Every POST needs an `Origin` header equal to the app origin (or, in development, an origin in `CORS_ORIGINS`). Otherwise 403 `origin_not_allowed` |
| Device cookie | `tdv`, HttpOnly, SameSite=Lax, Path=/api, 180 days, Secure in production. Set by GET /ai/status; required by POST /ai/suggest (else 401 `device_required`) |
| Validation | `extra="forbid"` everywhere; every string, number and list is bounded. 422 `validation_failed` lists field paths, never the submitted values |
| Body limit | `MAX_BODY_BYTES` (64 KB). Larger: 413 `payload_too_large` |
| Request id | Every response has `X-Request-Id` |
| Docs | `/docs`, `/redoc`, `/openapi.json` exist in development only (404 in production) |

### 0.2 Plan reference endpoints

The request plan mirrors the web app's Plan v1 schema (`web/src/domain/plan.ts`), including its defaults. Results equal the TypeScript engines (parity fixtures in `backend/tests/parity/fixtures`), except the documented divergences in TESTING.md §8.

**POST /api/v1/plan/template**
```json
{ "type": "birthday", "budgetTotalPaise": 7500001, "eventDate": "2027-02-14" }
```
Response 200 (abridged). The leftover paisa goes to the largest remainder; categories always sum to the total. A null budget gives zero allocations; a null date gives `dueDate: null`.
```json
{
  "type": "birthday", "budgetTotalPaise": 7500001, "eventDate": "2027-02-14",
  "categories": [
    { "key": "venue", "label": "Party Venue", "sharePercent": 25, "allocatedPaise": 1875000, "position": 1 },
    { "key": "catering", "label": "Catering & Beverages", "sharePercent": 35, "allocatedPaise": 2625001, "position": 2 }
  ],
  "tasks": [
    { "position": 1, "title": "Pick party theme and reserve venue", "categoryKey": "venue", "offsetDays": 30,
      "dueDate": "2027-01-15", "isMilestone": true, "dependsOnPositions": [] }
  ]
}
```

**POST /api/v1/plan/summary** with `{ "plan": Plan }`. "Today" is computed in the plan's `event.timezone`.
```json
{
  "today": "2026-10-28",
  "budget": { "allocatedPaise": 4500000, "plannedPaise": 0, "quotedPaise": 2800000, "paidPaise": 500000,
              "committedPaise": 2800000, "remainingPaise": 1700000, "unallocatedPaise": 3000000,
              "status": "ok", "percentCommitted": 62 },
  "categories": [ { "categoryId": "cat-food", "key": "catering", "label": "Food", "allocatedPaise": 2625000,
                    "plannedPaise": 0, "quotedPaise": 2800000, "paidPaise": 500000, "committedPaise": 2800000,
                    "remainingPaise": -175000, "status": "over", "percentCommitted": 100 } ],
  "overdueTasks": [ { "id": "t1", "title": "Reserve venue", "dueDate": "2026-10-17" } ],
  "dietCoverage": { "covered": ["veg", "jain"], "uncovered": ["nonVeg"], "fullyCovered": false }
}
```
Status rule: ARCHITECTURE.md §4.2 with an exact 90% threshold.

**POST /api/v1/plan/date-preview**
```json
{ "plan": { "...": "Plan v1" }, "newDate": "2027-03-01", "shiftFixedTasks": false }
```
```json
{
  "oldDate": "2027-02-14", "newDate": "2027-03-01", "deltaDays": 15,
  "shifted": [ { "id": "t1", "title": "Reserve venue", "oldDue": "2026-10-17", "newDue": "2026-11-01",
                 "offsetDays": 120, "dateMode": "relative", "becomesOverdue": false } ],
  "unchanged": [ { "id": "t3", "title": "Print banner", "dueDate": "2026-12-01" } ],
  "nowOverdue": []
}
```
422 `event_date_missing` when the plan has no event date. With `shiftFixedTasks: true`, fixed tasks move by `deltaDays` and appear in `shifted` with `offsetDays: null`.

**POST /api/v1/plan/validate** with `{ "plan": Plan }`
```json
{
  "valid": false,
  "problems": [
    { "code": "dependency_cycle", "severity": "error", "message": "Some tasks depend on each other in a loop.", "refs": ["a", "b"] },
    { "code": "diet_total_exceeds_guests", "severity": "error", "message": "Diet groups add up to 52, more than 50 guests.", "refs": [] },
    { "code": "schedule_overlap", "severity": "warning", "message": "Two schedule items overlap in the same function.", "refs": ["s1", "s2"] }
  ]
}
```
Codes: `dependency_cycle`, `diet_total_exceeds_guests` (error), `diet_total_mismatch`, `schedule_overlap`, `schedule_outside_window`, `quote_missing_units` (warnings).

### 0.3 AI endpoints

**GET /api/v1/ai/status**
```json
{ "available": true, "reason": null, "message": null, "remainingToday": 8, "limitToday": 8, "resetsAt": "2026-10-29T00:00:00Z" }
```
`limitToday` is the per-device daily limit (`AI_LIMIT_PER_DEVICE_PER_DAY`), shown as "AI suggestions left today: 6 of 8".
When `available` is false, `reason` is one of `no_key`, `limits_not_configured`, `provider_auth_failed`, `circuit_open`, `device_minute`, `device_day`, `ip_day`, `global_day`, `spend_cap`, and `message` is safe to show. Days are UTC days.

**POST /api/v1/ai/suggest**
```json
{
  "contract": "theme.suggest",
  "context": {
    "event_type": "birthday", "month": "2027-02", "days_until_event": 109, "city": "Noida",
    "guest_band": "26-75", "budget_total_inr": 75000,
    "diet_counts": { "veg": 40, "non_veg": 12, "jain": 8 },
    "functions": ["Birthday Celebration & Party"],
    "preferences": { "theme_words": ["garden"], "diet_focus": ["veg", "jain"], "customs": [], "avoid_colours": ["black"] },
    "existing_category_keys": ["venue", "catering"],
    "existing_task_titles": ["Confirm final headcount with catering"],
    "rejected_reasons": []
  },
  "feedback": null
}
```
`contract` is one of AI_SCHEMAS.md §3. `feedback` (max 500 characters) is required for `plan.revise` (422 `feedback_required`). `context` follows AI_SCHEMAS.md §2 exactly; any other field (notes, names, emails, an exact date) is rejected with 422.

Response 200:
```json
{
  "status": "ready",
  "items": [
    { "kind": "theme_idea", "title": "Garden afternoon", "description": "Soft greens and fairy lights.", "palette_words": ["sage", "cream"] },
    { "kind": "decor_idea", "title": "Balloon arch", "description": "Pastel arch at the entrance.", "estimate_inr_min": 3000, "estimate_inr_max": 6000 }
  ],
  "assumptions": [],
  "warnings": [],
  "message": null,
  "usage": { "inputTokens": 1180, "outputTokens": 340 }
}
```
`status`: `ready` (validated AI output), `fallback` (standard template items, only for `plan.generate` and `timeline.suggest`, with a message), `failed` (no items, a clear `message`; for example a refusal or invalid output after one repair). The server never returns invented AI content.

### 0.4 AI limits (checked in this order before xAI is called)

| Layer | Default | Response |
|---|---|---|
| 1. Device burst | `AI_LIMIT_PER_DEVICE_PER_MINUTE` = 2 | 429 `ai_limit_reached`, `layer: device_minute`, Retry-After to the next minute |
| 2. Device per day | `AI_LIMIT_PER_DEVICE_PER_DAY` = 5 | 429, `layer: device_day`, Retry-After to UTC midnight |
| 3. IP per day | `AI_LIMIT_PER_IP_PER_DAY` = 20 | 429, `layer: ip_day` |
| 4. Global per day | `AI_GLOBAL_DAILY_LIMIT` = 100 requests and `AI_DAILY_SPEND_LIMIT_USD` = 2.00 | 429, `layer: global_day` or `spend_cap` |
| 5. Provider guard | per provider: account RPM and TPM x `XAI_SAFETY_FACTOR`; `AI_MAX_CONCURRENT` = 3 in total | next provider tried; if none has capacity, 503 `ai_busy` with Retry-After (nothing is counted) |
| Every provider rate limited (429) | Retry-After up to 10 s, 1 retry per provider | 503 `ai_busy` |

The request is counted once, whichever provider (xAI or the Groq fallback) answers. See AI_SAFETY.md §10.

Layers 1 to 4 are atomic Postgres upserts shared by all workers; a request that fails a later layer leaves no count behind. The spend cap reserves a worst-case cost (estimated input + `AI_MAX_OUTPUT_TOKENS`) before the call and replaces it with the cost from xAI's reported usage afterwards.

### 0.5 Errors

Problem Details (`application/problem+json`) with `type`, `title`, `status`, `detail`, `code`, `instance`, and for 429/503 a `Retry-After` header.

| status | code |
|---|---|
| 400 | bad_request (malformed JSON) |
| 401 | device_required |
| 403 | origin_not_allowed |
| 404 | not_found |
| 413 | payload_too_large |
| 422 | validation_failed, feedback_required, event_date_missing |
| 429 | rate_limited (general API limit), ai_limit_reached |
| 500 | internal_error (no internals in `detail`) |
| 503 | ai_busy, ai_unavailable, database_unavailable |

## 1. Conventions

| Topic | Rule |
|---|---|
| Auth | Session cookie `sid` (HttpOnly, Secure, SameSite=Lax). All endpoints except health, register and login require it. Missing or expired session: 401 |
| CSRF | Every POST, PUT, PATCH and DELETE needs header `X-CSRF-Token` matching the token returned by `GET /auth/me` and login. Mismatch: 403 |
| Money | Request and response money fields are integer paise, suffix `_paise`. The client formats INR |
| Dates | `YYYY-MM-DD`; times `HH:MM` (24 h) in the event timezone |
| Validation | Pydantic models with `extra="forbid"`. Unknown fields: 422 |
| Body limit | 64 KB per request [D]. Larger: 413 |
| Concurrency | Event updates send `version`. Mismatch: 409 with the current resource |
| Idempotency | `Idempotency-Key` header (UUID) required on `POST /events` and `POST /events/{id}/plans`; optional elsewhere. Same key and same user within 24 h returns the stored response |
| Rate limits | 120 requests per minute per user; 10 plan generations per hour and 30 per day per user (FR-AI-08). Excess: 429 with `Retry-After` |
| Pagination | Not needed in MVP; list endpoints are scoped to one event and capped (tasks 500, expenses 1000, vendors 200) |
| Ownership | Resources of another user return 404 |

### Error format (RFC 9457 Problem Details)

`Content-Type: application/problem+json`

```json
{
  "type": "https://errors.local/validation",
  "title": "Some fields need attention",
  "status": 422,
  "detail": "Check the highlighted fields.",
  "instance": "/api/v1/events",
  "code": "validation_failed",
  "errors": [{ "field": "budget_total_paise", "message": "Enter an amount of ₹0 or more." }]
}
```

| status | code | When |
|---|---|---|
| 400 | bad_request | Malformed JSON |
| 401 | not_authenticated | No or expired session |
| 403 | csrf_failed | CSRF header missing or wrong |
| 404 | not_found | Missing or not owned |
| 409 | version_conflict, dependency_blocked, category_in_use | Concurrency or state conflict |
| 413 | payload_too_large | Body over 64 KB |
| 422 | validation_failed, dependency_cycle, diet_total_exceeds_guests | Field or domain validation |
| 429 | rate_limited, ai_limit_reached | Limits |
| 502 | ai_provider_error | Provider returned an error or invalid output after retry |
| 503 | ai_unavailable | Circuit breaker open or AI disabled |
| 500 | internal_error | Unexpected; `detail` never contains internals |

Server messages are short, plain and safe to show in the UI.

## 2. Endpoint catalogue (later: optional accounts and sync, not implemented)

| ID | Method and path | Purpose | Requirements | Side effects |
|---|---|---|---|---|
| E-01 | GET /health | Liveness | NFR | None |
| E-02 | GET /health/ready | DB ping | NFR | None |
| E-03 | POST /auth/register | Create account and session | FR-AUTH-01 | users, sessions |
| E-04 | POST /auth/login | Create session | FR-AUTH-02 | sessions |
| E-05 | POST /auth/logout | End session | FR-AUTH-03 | sessions delete |
| E-06 | GET /auth/me | Current user and CSRF token | FR-AUTH-02 | None |
| E-07 | PATCH /account | Update timezone | FR-AUTH-04 | users |
| E-08 | DELETE /account | Delete account and all data | FR-AUTH-04 | cascade delete |
| E-10 | GET /events | List events with summary | FR-EVT-02 | None |
| E-11 | POST /events | Create draft event (wizard step 1) | FR-EVT-01 | events |
| E-12 | GET /events/{id} | Event detail with overview summary | FR-EVT-02 | None |
| E-13 | PATCH /events/{id} | Update fields, wizard steps, preferences; `finalize: true` runs template | FR-EVT-01, 03, 07 | events; on finalize: budget_categories, tasks, guest_summaries |
| E-14 | DELETE /events/{id} | Delete event | FR-EVT-05 | cascade delete, audit |
| E-15 | POST /events/{id}/date-change/preview | Preview task shifts | FR-EVT-04 | None |
| E-16 | POST /events/{id}/date-change | Apply new date | FR-EVT-04 | events, tasks, audit |
| E-17 | GET /events/{id}/functions | List functions | FR-EVT-06 | None |
| E-18 | POST /events/{id}/functions | Add function | FR-EVT-06 | event_functions |
| E-19 | PATCH /functions/{fid} | Edit function | FR-EVT-06 | event_functions |
| E-20 | DELETE /functions/{fid} | Delete function and its schedule items | FR-EVT-06 | cascade |
| E-21 | GET /events/{id}/budget | Categories, expenses and computed summary | FR-BUD-02, 04 | None |
| E-22 | POST /events/{id}/budget/categories | Add category | FR-BUD-01 | budget_categories |
| E-23 | PATCH /budget/categories/{cid} | Rename, reallocate, move position | FR-BUD-01, 02 | budget_categories |
| E-24 | DELETE /budget/categories/{cid} | Delete empty category | FR-BUD-01 | 409 category_in_use if expenses exist |
| E-25 | POST /events/{id}/expenses | Add expense | FR-BUD-03 | expenses |
| E-26 | PATCH /expenses/{xid} | Edit expense | FR-BUD-03 | expenses |
| E-27 | DELETE /expenses/{xid} | Delete expense | FR-BUD-03 | expenses |
| E-30 | GET /events/{id}/tasks | List tasks with dependencies | FR-TSK-01 | None |
| E-31 | POST /events/{id}/tasks | Add task | FR-TSK-01 | tasks |
| E-32 | PATCH /tasks/{tid} | Edit task, dependencies, position | FR-TSK-01, 03, 05 | tasks, task_dependencies |
| E-33 | DELETE /tasks/{tid} | Delete task | FR-TSK-01 | tasks |
| E-34 | POST /tasks/{tid}/complete | Complete | FR-TSK-02, 03 | 409 dependency_blocked if prerequisites open |
| E-35 | POST /tasks/{tid}/reopen | Reopen | FR-TSK-02 | tasks |
| E-40 | GET /events/{id}/vendors | List vendors with quotes | FR-VEN-01 | None |
| E-41 | POST /events/{id}/vendors | Add vendor | FR-VEN-01 | vendors |
| E-42 | PATCH /vendors/{vid} | Edit vendor | FR-VEN-01 | vendors |
| E-43 | DELETE /vendors/{vid} | Delete vendor; response states unlinked expense count | FR-VEN-04 | vendors, quotes, expenses.vendor_id null |
| E-44 | POST /vendors/{vid}/quotes | Add quote | FR-VEN-02 | quotes |
| E-45 | PATCH /quotes/{qid} | Edit quote | FR-VEN-02 | quotes |
| E-46 | DELETE /quotes/{qid} | Delete quote | FR-VEN-02 | quotes |
| E-47 | GET /events/{id}/quotes/compare?category= | Normalised comparison | FR-VEN-03 | None |
| E-50 | GET /events/{id}/guests | Guest summary and diet coverage | FR-GST-01, 02 | None |
| E-51 | PUT /events/{id}/guests | Replace guest summary | FR-GST-01, 02 | guest_summaries |
| E-55 | GET /events/{id}/schedule | Functions with items and conflicts | FR-SCH-01, 02 | None |
| E-56 | POST /functions/{fid}/schedule-items | Add item | FR-SCH-01 | schedule_items |
| E-57 | PATCH /schedule-items/{sid} | Edit or move item | FR-SCH-01 | schedule_items |
| E-58 | DELETE /schedule-items/{sid} | Delete item | FR-SCH-01 | schedule_items |
| E-60 | GET /events/{id}/ideas | List ideas | FR-IDEA-01 | None |
| E-61 | POST /events/{id}/ideas | Add own idea | FR-IDEA-01 | ideas |
| E-62 | DELETE /ideas/{iid} | Delete idea | FR-IDEA-01 | ideas |
| E-70 | POST /events/{id}/plans | Generate a revision for a contract | FR-AI-01, 02, 03, 06, 08 | ai_plan_revisions, ai_suggestion_items; calls xAI |
| E-71 | GET /events/{id}/plans | List revisions (metadata) | FR-AI-02 | None |
| E-72 | GET /plans/{rid} | Revision with items | FR-AI-01 | None |
| E-73 | POST /plans/{rid}/apply | Apply accepted item ids | FR-AI-04 | target tables, items, audit |
| E-74 | POST /plans/{rid}/items/{iid}/reject | Reject item | FR-AI-05 | ai_suggestion_items |
| E-75 | POST /plans/{rid}/items/{iid}/undo | Return a rejected item to pending | FR-AI-05 | ai_suggestion_items |
| E-80 | GET /events/{id}/export?scope=budget\|tasks | CSV download | FR-EXP-01 | None |

There is no generic chat or prompt endpoint.

## 3. Key contracts

### E-11 POST /events
Request:
```json
{ "type": "birthday", "title": "Aarav turns 7" }
```
Response 201: `EventOut` (below) with `status: "draft"`, `wizard_step: 1`.

### E-13 PATCH /events/{id}
Request (any subset, plus `version`):
```json
{
  "version": 3,
  "event_date": "2027-02-14",
  "city": "Noida",
  "guest_estimate": 60,
  "budget_total_paise": 7500000,
  "preferences": { "theme_words": ["garden", "pastel-free"], "diet_focus": ["veg", "jain"], "customs": [], "avoid_colours": [] },
  "wizard_step": 4,
  "finalize": true
}
```
Validation: on `finalize`, `event_date` today or later (event timezone), `budget_total_paise` set, `guest_estimate` set. Finalize runs `TemplateService.apply` once; repeated finalize is a no-op.
Response 200 `EventOut`:
```json
{
  "id": "6f1c…", "type": "birthday", "title": "Aarav turns 7", "status": "active",
  "event_date": "2027-02-14", "timezone": "Asia/Kolkata", "city": "Noida",
  "guest_estimate": 60, "budget_total_paise": 7500000, "currency": "INR",
  "preferences": { "theme_words": ["garden"], "diet_focus": ["veg","jain"], "customs": [], "avoid_colours": [] },
  "wizard_step": 4, "version": 4,
  "summary": { "days_remaining": 111, "tasks_open": 14, "tasks_overdue": 0, "budget_status": "ok", "allocated_paise": 7500000, "committed_paise": 0 }
}
```
Navigation: client routes to `/events/{id}` after finalize (UX_FLOWS.md N-07).

### E-15 POST /events/{id}/date-change/preview
Request: `{ "new_date": "2027-03-01", "shift_fixed_tasks": false }`
Response 200:
```json
{
  "old_date": "2027-02-14", "new_date": "2027-03-01",
  "shifted": [{ "task_id": "…", "title": "Book venue", "old_due": "2026-11-16", "new_due": "2026-12-01" }],
  "unchanged_fixed": 2,
  "now_overdue": [],
  "warnings": []
}
```
E-16 takes the same body plus `version`, recomputes the same result inside a transaction and applies it. Response: `EventOut`.

### E-21 GET /events/{id}/budget
```json
{
  "total_paise": 7500000,
  "categories": [
    { "id": "…", "key": "food", "label": "Food", "allocated_paise": 2625000,
      "planned_paise": 0, "quoted_paise": 2800000, "paid_paise": 500000,
      "committed_paise": 2800000, "remaining_paise": -175000, "status": "over", "position": 1 }
  ],
  "totals": { "allocated_paise": 7500000, "committed_paise": 2800000, "paid_paise": 500000, "remaining_paise": 4700000, "status": "ok", "unallocated_paise": 0 },
  "expenses": [ { "id": "…", "category_id": "…", "vendor_id": null, "description": "Caterer advance", "amount_paise": 500000, "kind": "paid", "spent_on": "2026-11-02", "note": null } ]
}
```
`committed_paise` rule is defined once in ARCHITECTURE.md §4.2.

### E-47 GET /events/{id}/quotes/compare?category=catering
```json
{
  "category": "catering", "guest_basis": 60,
  "rows": [
    { "vendor_id": "…", "vendor_name": "Vendor A", "quote_id": "…", "total_paise": 2700000, "per_guest_paise": 45000, "missing_inclusions": ["service staff"], "valid_until": "2026-12-01", "expired": false }
  ],
  "cheapest_quote_id": "…"
}
```
`guest_basis` is `guest_summaries.total_guests`, or `events.guest_estimate` when the summary is empty.

### E-51 PUT /events/{id}/guests
```json
{ "total_guests": 60, "veg": 40, "non_veg": 12, "jain": 8, "eggetarian": 0, "vegan": 0, "allergy_tags": ["peanut"], "accessibility_needs": ["step_free"] }
```
422 `diet_total_exceeds_guests` if the diet sum is greater than `total_guests`. Response adds `uncovered_diets` computed against menu ideas.

### E-70 POST /events/{id}/plans
Request:
```json
{ "contract": "plan.generate", "feedback": null, "base_revision_id": null }
```
`contract` is one of AI_SCHEMAS.md §3. `feedback` max 500 chars, required for `plan.revise`.
Processing: synchronous, total budget 45 s (NFR-03). Response 201:
```json
{ "revision": { "id": "…", "contract": "plan.generate", "status": "ready", "model": "grok-4.3", "created_at": "…" },
  "items": [ { "id": "…", "kind": "task", "decision": "pending", "payload": { "title": "Book a party venue", "offset_days": 21, "category_key": "venue", "is_milestone": true } } ],
  "assumptions": ["Guest count may change by 10%"], "warnings": [] }
```
If the provider fails after retry and fallback applies, status is `fallback` and items come from the deterministic template (AI_SAFETY.md §6). 429 `ai_limit_reached` when limits are hit.

### E-73 POST /plans/{rid}/apply
Request: `{ "item_ids": ["…","…"], "event_version": 4 }`
Validation: items belong to the revision, are pending, and pass re-validation (AI_SCHEMAS.md §5). All-or-nothing transaction.
Response 200:
```json
{ "applied": 5, "created": { "tasks": 3, "ideas": 2 }, "updated": { "budget_categories": 0 }, "event_version": 5 }
```

### E-80 GET /events/{id}/export?scope=budget
Response 200 `text/csv; charset=utf-8` with `Content-Disposition: attachment; filename="budget-<event-slug>.csv"`. Amounts in rupees with two decimals, no grouping, so spreadsheets parse them. UTF-8 BOM included for Excel [A].

## 4. Frontend usage

Implemented (Nov 2026):
- One client, `web/src/api/client.ts` (`apiRequest`): base `/api/v1`, JSON in and out, the device cookie (`credentials: 'same-origin'`), a timeout via `AbortController` (15 s; 90 s for AI), one automatic retry for GET when the backend is unreachable and never for POST. Problem Details become a typed `ApiError` (`status`, `code`, `title`, `detail`, `retryAfter`, and the raw `problem` for extension members such as `layer`). Status 0 means unreachable (`network` or `timeout`).
- Types are generated, not hand-written: `backend/scripts/export_openapi.py` writes `web/openapi.json`, and `npm run api:types` turns it into `web/src/api/schema.ts`. CI fails when either is out of date (`api:types:check`).
- Endpoint wrappers: `web/src/api/plan.ts` (template, summary, date-preview, validate) and `web/src/api/ai.ts` (status, suggest). TanStack Query is not used: the few server calls belong to the screens that need them (`lib/usePlanSummary.ts` debounces summary calls by 400 ms).
- The backend result is the source of truth. The browser's own engines give an instant preview while a request runs and the offline fallback, shown with "Live check unavailable. Showing figures calculated on this device."

Original design notes (accounts phase, not implemented):
- A single `apiClient` wraps `fetch`, adds `X-CSRF-Token`, parses Problem Details, and throws typed `ApiError`.
- TanStack Query owns server state. Mutations invalidate the event's query keys on success.
- Loading: queries show skeletons after 300 ms; mutations disable the triggering button and show a spinner inside it.
- Errors: field errors map to form fields; other errors show an inline error panel with Retry (UX_FLOWS.md §6).
- AI generation: the button enters a busy state and the progress panel shows staged text while E-70 is pending.
