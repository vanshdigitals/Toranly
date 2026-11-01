# Database

Engine: PostgreSQL on Neon Free (RR §8.2). Access: SQLAlchemy 2.1 with psycopg 3. Migrations: Alembic.
Related: [ARCHITECTURE.md](ARCHITECTURE.md), [API.md](API.md), [SECURITY.md](SECURITY.md).

## 0. Server tables in this phase (Phase 3, implemented)

The backend is stateless for event data. These three tables are the **only** server tables (migration `backend/app/db/alembic/versions/0001_ai_usage.py`). Days are UTC.

### ai_usage
| Column | Type | Null | Notes |
|---|---|---|---|
| device_hash | varchar(64) | no | SHA-256 hex of the random device id from the signed `tdv` cookie |
| day | date | no | |
| minute_bucket | smallint | no | minute of the day, 0 to 1439 (CHECK) |
| count | integer | no | requests reserved (CHECK >= 0) |
| input_tokens, output_tokens | bigint | no | from xAI usage |
PK (device_hash, day, minute_bucket). INDEX (day) for cleanup.

### ai_ip_usage
| Column | Type | Null | Notes |
|---|---|---|---|
| ip_hash | varchar(64) | no | HMAC-SHA256(IP_HASH_SALT, ip) |
| day | date | no | |
| count | integer | no | CHECK >= 0 |
PK (ip_hash, day). INDEX (day).

### ai_global_usage
| Column | Type | Null | Notes |
|---|---|---|---|
| day | date | no | PK |
| count | integer | no | requests reserved |
| input_tokens, output_tokens | bigint | no | |
| est_cost_usd | numeric(12,6) | no | reservations plus corrected actual cost (CHECK >= 0) |

Rules: all increments are atomic upserts (`INSERT … ON CONFLICT … DO UPDATE … WHERE count < limit`), with a per-device transaction advisory lock for the device layers (AI_SAFETY.md §9). Rows older than 30 days are deleted at startup and daily (`python -m app.db.cleanup` runs it once). The downgrade drops all three tables and is tested (TESTING.md T-DB-02).

## Later: optional sync

Everything below (§1 to §9) describes the browser storage that exists today (§1.1) and the account-based server schema planned for a later optional sync phase. The server tables in §2 to §9 (users, sessions, events and children, AI revisions, audit, idempotency) are **not created** in Phase 3.

## 1. Conventions

- Primary keys: `uuid` or string IDs generated client-side (`plan-...`, `cat-...`, `task-...`).
- Money: `bigint` / integer paise with non-negative constraints. Never floating point.
- Timestamps: `createdAt`, `updatedAt` as ISO-8601 strings.
- Dates: `YYYY-MM-DD` (local calendar date). Times: `HH:MM` (24-hour).
- Schemas: Validated strictly via Zod (`PlanSchema`, `PlanSnapshotSchema`, `ToranlyBackupSchema`).

## 1.1 Browser Client Storage (IndexedDB `toranly`, v1)

Under Guest-First Planning (Option C), celebration data is stored directly in the browser's IndexedDB:

| Object Store | Key Path | Indexes | Purpose |
|---|---|---|---|
| `plans` | `id` | — | Active celebration plan documents conforming to `PlanSchema` (schemaVersion 1). |
| `snapshots` | `id` | `planId` | Automatic rollback snapshots taken during edits (capped at 3 per plan). |
| `meta` | `key` | — | Browser metadata: `lastOpenedPlanId`, `storageWarningSeen`, `persistRequested`, `persistGranted`. |

### Backup Format (`.toranly.json`)
Celebration backups are exported and imported as valid JSON files up to 2MB in size:
```json
{
  "format": "toranly-backup",
  "schemaVersion": 1,
  "exportedAt": "2026-10-28T16:00:00.000Z",
  "plans": [ /* array of Plan documents validated against PlanSchema */ ]
}
```

### Migration Helper (`migrate()`)
All imported backup files and legacy prototype drafts are passed through `migrate(raw)` to validate types and populate required default structures (functions, preferences, diet breakdown) up to `schemaVersion: 1`.

## 2. Entity decisions

| Entity evaluated | Decision |
|---|---|
| Users | Yes (`users`), auth is required to protect personal plans |
| Event preferences | Column `events.preferences jsonb`, validated by Pydantic. A separate table adds joins with no benefit |
| Budget categories and allocations | One table `budget_categories` with `allocated_paise`. Allocation is a property of a category |
| Expenses | Yes |
| Tasks and milestones | One table `tasks` with `is_milestone` flag |
| Vendors, quotes | Yes, two tables |
| Event schedules | `event_functions` plus `schedule_items` |
| Guests | Aggregate `guest_summaries` (one row per event). Individual guests are deferred |
| Ideas | `ideas` (accepted AI ideas and manual ideas) |
| AI plans and revisions | `ai_plan_revisions` and `ai_suggestion_items`. These hold AI generation state and are separate from user data until applied |
| Audit | `audit_records` for consequential changes only (date change, AI apply, deletes) |
| Sessions | `sessions` for revocable server-side sessions |
| Idempotency | `idempotency_keys` for create and generate endpoints |

## 3. Tables

### users
| Column | Type | Null | Notes |
|---|---|---|---|
| id | uuid PK | no | |
| email | text | no | Stored lower-case. UNIQUE |
| password_hash | text | no | argon2id |
| timezone | text | no | Default `Asia/Kolkata`, IANA name validated in Python |
| created_at, updated_at | timestamptz | no | |

### sessions
| Column | Type | Null | Notes |
|---|---|---|---|
| id | uuid PK | no | |
| user_id | uuid FK users ON DELETE CASCADE | no | INDEX |
| token_hash | text | no | SHA-256 of the random session token. UNIQUE |
| csrf_token_hash | text | no | |
| expires_at | timestamptz | no | created_at + 14 days |
| created_at | timestamptz | no | |

### events
| Column | Type | Null | Notes |
|---|---|---|---|
| id | uuid PK | no | |
| owner_id | uuid FK users ON DELETE CASCADE | no | |
| type | text | no | wedding, engagement, birthday, anniversary, community, family |
| title | text | no | 1 to 120 chars |
| event_date | date | yes | Null only while wizard draft is incomplete |
| timezone | text | no | Copied from user default |
| city | text | yes | Max 80 chars |
| guest_estimate | integer | no | CHECK 0 to 10000 |
| budget_total_paise | bigint | no | CHECK >= 0 |
| currency | text | no | Fixed `INR` in MVP |
| preferences | jsonb | no | Default `{}`. Schema in AI_SCHEMAS.md §2 (EventPreferences) |
| status | text | no | draft, active, completed |
| wizard_step | smallint | no | 1 to 4, for resuming drafts |
| version | integer | no | Optimistic lock, +1 on every update |
| created_at, updated_at | timestamptz | no | |
INDEX (owner_id, event_date).

### event_functions
| Column | Type | Null | Notes |
|---|---|---|---|
| id | uuid PK | no | |
| event_id | uuid FK events ON DELETE CASCADE | no | INDEX |
| name | text | no | 1 to 60 chars |
| date | date | no | |
| start_time, end_time | time | yes | end > start when both set |
| position | smallint | no | Order |

### budget_categories
| Column | Type | Null | Notes |
|---|---|---|---|
| id | uuid PK | no | |
| event_id | uuid FK events ON DELETE CASCADE | no | |
| key | text | no | Slug, for example `catering` |
| label | text | no | |
| allocated_paise | bigint | no | CHECK >= 0 |
| position | smallint | no | |
UNIQUE (event_id, key).

### expenses
| Column | Type | Null | Notes |
|---|---|---|---|
| id | uuid PK | no | |
| event_id | uuid FK events ON DELETE CASCADE | no | INDEX |
| category_id | uuid FK budget_categories ON DELETE RESTRICT | no | Blocks category delete (FR-BUD-01) |
| vendor_id | uuid FK vendors ON DELETE SET NULL | yes | Unlink on vendor delete (FR-VEN-04) |
| description | text | no | 1 to 120 chars |
| amount_paise | bigint | no | CHECK > 0 |
| kind | text | no | planned, quoted, paid |
| spent_on | date | yes | |
| note | text | yes | Max 500 chars |

### tasks
| Column | Type | Null | Notes |
|---|---|---|---|
| id | uuid PK | no | |
| event_id | uuid FK events ON DELETE CASCADE | no | |
| title | text | no | 1 to 120 chars |
| notes | text | yes | Max 1000 chars |
| category_key | text | yes | Links to a budget category key for grouping |
| offset_days | integer | yes | Days before event. Set for template and AI tasks |
| due_date | date | yes | Derived from offset when offset is set |
| date_mode | text | no | `relative` or `fixed` |
| is_milestone | boolean | no | Default false |
| status | text | no | open, done |
| completed_at | timestamptz | yes | |
| source | text | no | template, ai, user |
| position | integer | no | |
INDEX (event_id, due_date).

### task_dependencies
| Column | Type | Notes |
|---|---|---|
| task_id | uuid FK tasks ON DELETE CASCADE | |
| depends_on_task_id | uuid FK tasks ON DELETE CASCADE | |
PK (task_id, depends_on_task_id). CHECK task_id <> depends_on_task_id. Acyclicity enforced in `domain/dependency_graph.py`.

### vendors
| Column | Type | Null | Notes |
|---|---|---|---|
| id | uuid PK | no | |
| event_id | uuid FK events ON DELETE CASCADE | no | INDEX |
| category_key | text | no | |
| name | text | no | Entered by user only |
| phone | text | yes | Personal data; never logged or sent to AI |
| email | text | yes | Same |
| status | text | no | shortlisted, booked, dropped |
| notes | text | yes | Max 1000 chars |

### quotes
| Column | Type | Null | Notes |
|---|---|---|---|
| id | uuid PK | no | |
| vendor_id | uuid FK vendors ON DELETE CASCADE | no | INDEX |
| amount_paise | bigint | no | CHECK > 0 |
| unit | text | no | total, per_plate, per_guest |
| units | integer | yes | Required when unit is not total. CHECK > 0 |
| inclusions | jsonb | no | Array of strings, max 20 |
| valid_until | date | yes | |

### guest_summaries
| Column | Type | Null | Notes |
|---|---|---|---|
| event_id | uuid PK, FK events ON DELETE CASCADE | no | |
| total_guests | integer | no | CHECK >= 0 |
| veg, non_veg, jain, eggetarian, vegan | integer | no | Each CHECK >= 0; sum <= total enforced in domain |
| allergy_tags | jsonb | no | Array of strings |
| accessibility_needs | jsonb | no | Array of enum: step_free, seating, hearing_support, visual_support, other |

### schedule_items
| Column | Type | Null | Notes |
|---|---|---|---|
| id | uuid PK | no | |
| function_id | uuid FK event_functions ON DELETE CASCADE | no | INDEX |
| start_time | time | no | |
| duration_min | integer | no | CHECK 5 to 600 |
| title | text | no | |
| notes | text | yes | |
| position | integer | no | |

### ideas
| Column | Type | Null | Notes |
|---|---|---|---|
| id | uuid PK | no | |
| event_id | uuid FK events ON DELETE CASCADE | no | INDEX |
| kind | text | no | theme, decor, menu, saving, other |
| title | text | no | |
| body | text | yes | |
| diet_tags | jsonb | no | For menu ideas; default `[]` |
| estimate_min_paise, estimate_max_paise | bigint | yes | AI estimate range, shown with "Estimate" label |
| source | text | no | ai, user |
| source_item_id | uuid FK ai_suggestion_items ON DELETE SET NULL | yes | |

### ai_plan_revisions
| Column | Type | Null | Notes |
|---|---|---|---|
| id | uuid PK | no | |
| event_id | uuid FK events ON DELETE CASCADE | no | INDEX (event_id, created_at) |
| contract | text | no | One of the contracts in AI_SCHEMAS.md §3 |
| contract_version | text | no | For example `1.0` |
| model | text | no | Model id actually used |
| status | text | no | ready, failed, fallback |
| input_hash | text | no | SHA-256 of the sanitised prompt payload |
| feedback | text | yes | User revision text |
| output | jsonb | yes | Validated output; null when failed |
| error_code | text | yes | |
| input_tokens, output_tokens | integer | yes | From provider usage |
| created_by | uuid FK users | no | Used for rate limits |
| created_at | timestamptz | no | |

### ai_suggestion_items
| Column | Type | Null | Notes |
|---|---|---|---|
| id | uuid PK | no | |
| revision_id | uuid FK ai_plan_revisions ON DELETE CASCADE | no | INDEX |
| kind | text | no | budget_share, task, theme_idea, decor_idea, menu_item, vendor_category, saving_idea, schedule_item |
| payload | jsonb | no | Validated item |
| decision | text | no | pending, accepted, rejected |
| reason | text | yes | Max 200 chars |
| decided_at | timestamptz | yes | |

### audit_records
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| event_id | uuid FK events ON DELETE CASCADE, nullable | |
| actor_id | uuid FK users ON DELETE CASCADE | |
| action | text | event.date_changed, ai.applied, event.deleted (written before delete with event_id null) and similar |
| summary | jsonb | Counts and ids only, no personal text |
| created_at | timestamptz | Append-only |

### idempotency_keys
| Column | Type | Notes |
|---|---|---|
| key | text | |
| user_id | uuid FK users ON DELETE CASCADE | |
| endpoint | text | |
| response_status | integer | |
| response_body | jsonb | |
| created_at | timestamptz | Purged after 24 h |
PK (user_id, key).

## 4. Ownership and tenant isolation

- Repositories take `owner_id` on every method. Event-scoped queries use `WHERE events.id = :id AND events.owner_id = :owner`. Child objects (expense, task, vendor, quote, schedule item, idea, revision) are loaded through a join to `events` with the same owner filter.
- A row owned by someone else returns 404, never 403.
- Postgres row-level security is deferred. Cross-tenant tests in TESTING.md T-SEC-01 guard the repository layer.

## 5. Transactions

- Wizard step save, template creation, date change apply, AI apply and event delete each run in one transaction.
- Optimistic locking: `PATCH /events/{id}` and date change require the current `version`. A mismatch returns 409.

## 6. Migrations

- Alembic, one migration per change, reviewed in PRs. `alembic upgrade head` runs as a release step before the new app starts (ARCHITECTURE.md §7).
- Every migration has a tested downgrade in CI (TESTING.md T-DB-02).
- Template data (categories and tasks per event type) lives in Python (`domain/templates.py`), not in seed tables, so it is versioned with code.

## 7. Retention and deletion

| Data | Retention |
|---|---|
| Events and children | Until the user deletes the event or account |
| AI revision `output` | Pruned to null after 90 days [A]; metadata kept for usage counts |
| Sessions | Deleted at expiry by a startup cleanup and on logout |
| Idempotency keys | 24 hours |
| Audit records | Deleted with the event or account |

Account deletion cascades through `users` to all owned data.

## 8. Backup and recovery limits

- Neon Free offers a short restore window (6 hours per earlier third-party sources [V-3P]; confirm on the plans page [U]).
- Mitigation [D]: a scheduled GitHub Actions workflow runs `pg_dump` nightly and stores the dump as a private workflow artifact for 7 days. Residual risk: data written between dumps can be lost.

## 9. Persistent vs temporary AI state

AI output lives in `ai_plan_revisions` and `ai_suggestion_items` only. It reaches `budget_categories`, `tasks`, `ideas` or `schedule_items` only through `POST /plans/{revision_id}/apply` (AI_SAFETY.md §5).
