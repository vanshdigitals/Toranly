# Product Requirements Document

Project: Celebration & Event Planner (temporary name). Status: MVP specification, pre-implementation.
Related: [RESEARCH_REPORT.md](RESEARCH_REPORT.md), [UX_FLOWS.md](UX_FLOWS.md), [API.md](API.md), [TESTING.md](TESTING.md).

## 1. Vision

A planning workspace that helps people in India organise weddings, birthdays, anniversaries, community events and family celebrations. It manages the budget, timeline, vendors, guests and day-of schedule with reliable, deterministic tools. AI helps with ideas and first drafts, and the user decides what to keep.

## 2. Problem

- Wedding planners in the market cover weddings only. Invitation tools cover RSVPs only (RR §1).
- People plan smaller celebrations in notes and spreadsheets, so budgets drift and tasks are missed.
- Generic chatbots give ideas but do not keep a budget that adds up or a timeline tied to the event date.

## 3. Target users (hypothetical personas, not research findings)

| ID | Persona | Need |
|---|---|---|
| P1 | Family member planning a wedding with several functions | Track a large INR budget and many vendors |
| P2 | Parent planning a child's birthday in 3 weeks | Quick checklist, simple budget, food for mixed diets |
| P3 | Volunteer organising a community event | Tasks, vendors and a run-of-show schedule |

## 4. MVP scope

Features F1 to F8 as defined in RR §1.4. Non-goals: everything listed as deferred in RR §1.4.

### Guest-First Planning Architecture (Option C, Approved)
- **No mandatory login**: Visitors can immediately begin planning via "Start planning" on the landing page, which always opens the event wizard at step 1 (`/events/new`). A "My plans" link (`/events`) is available in the header, mobile drawer, and wizard step 1 whenever saved plans exist on this device.
- **Local browser persistence**: Plans, automatic snapshots (last 3 versions), and preferences are saved client-side via IndexedDB (`toranly` DB). In-memory fallback is active if IndexedDB is blocked.
- **My Plans screen (`/events`)**: Create, open, download backup, and safely delete plans (requiring title confirmation).
- **Backup & restore**: Validated `.toranly.json` files (max 2MB, Zod schema validation) allow exporting and restoring celebration plans across browsers or devices without a cloud account.
- **Deterministic domain logic**: Money split with largest-remainder algorithm, committed/remaining budget rules (max of planned, quoted, paid), timeline offsets, Kahn's cycle detection, diet constraint checks.
- **Print & export**: A4 print-friendly view (`/events/:id/print`) and client-side CSV downloads with formula injection escaping.
- **Account optionality**: Cloud accounts are disabled by default (`FEATURE_ACCOUNTS = false`) and preserved for future multi-device sync.

## 5. User stories

| ID | Story | Requirements |
|---|---|---|
| US-01 | As P2, I create an event in under 3 minutes and get a ready checklist and budget | FR-EVT-01, FR-EVT-07 |
| US-02 | As P1, I see where my budget stands and which category is over | FR-BUD-04 |
| US-03 | As P1, I move the wedding date and see which tasks shift before I confirm | FR-EVT-04 |
| US-04 | As P3, I compare two caterer quotes per guest | FR-VEN-03 |
| US-05 | As any user, I ask AI for theme and menu ideas and keep only the ones I like | FR-AI-01, FR-AI-04, FR-AI-05 |
| US-06 | As P2, I check that the menu covers veg, Jain and non-veg guests | FR-GST-02 |
| US-07 | As P3, I build a day-of schedule without overlaps | FR-SCH-01, FR-SCH-02 |
| US-08 | As any user, I export my budget and tasks to a spreadsheet | FR-EXP-01 |

## 6. Functional requirements

### Accounts
| ID | Requirement |
|---|---|
| FR-AUTH-01 | Users register with email and password (min 10 characters). |
| FR-AUTH-02 | Users sign in and stay signed in for 14 days unless they sign out. |
| FR-AUTH-03 | Users sign out from any screen via the account menu. |
| FR-AUTH-04 | Users set a default timezone (default Asia/Kolkata) and can delete their account and all data. |

### Events
| ID | Requirement |
|---|---|
| FR-EVT-01 | A 4-step wizard creates an event: type, details, budget and guests, preferences. Each step saves a draft. |
| FR-EVT-02 | The dashboard lists the user's events sorted by date, with days remaining and budget health. |
| FR-EVT-03 | Users edit title, city, guest estimate, total budget and preferences. |
| FR-EVT-04 | Changing the event date shows a preview of shifted, overdue and invalid tasks. Changes apply only after confirmation. |
| FR-EVT-05 | Users delete an event after typing its title to confirm. All event data is removed. |
| FR-EVT-06 | Users add, edit and remove sub-functions (for example haldi, sangeet, reception) with date and time window. |
| FR-EVT-07 | On creation, a deterministic template creates budget categories (percentage split of the total) and tasks for the event type. No AI is needed. |

### Budget
| ID | Requirement |
|---|---|
| FR-BUD-01 | Users add, rename, reorder (buttons) and delete budget categories. Deleting a category with expenses is blocked until expenses are moved or deleted. |
| FR-BUD-02 | Users set an allocation per category in INR. The system shows allocated total vs event total. |
| FR-BUD-03 | Users add, edit and delete expenses with amount, kind (planned, quoted, paid), category, optional vendor, date and note. |
| FR-BUD-04 | The system computes per category and overall: allocated, committed, paid, remaining and status (ok, warning at 90% or more, over above 100%). |
| FR-BUD-05 | All money displays in INR with Indian digit grouping (₹12,34,567). Compact form (₹12.3 L) is used only in summary cards, with the full value available to assistive tech. |

### Timeline and tasks
| ID | Requirement |
|---|---|
| FR-TSK-01 | Users add, edit and delete tasks with title, due date, category, notes and milestone flag. |
| FR-TSK-02 | Users complete and reopen tasks. Progress updates immediately. |
| FR-TSK-03 | Users set one or more prerequisite tasks. Cycles are rejected. A task cannot be completed before its prerequisites. |
| FR-TSK-04 | Overdue tasks are flagged with icon and text. |
| FR-TSK-05 | Template and AI tasks store an offset in days before the event, so date changes recompute due dates. User-set absolute dates are kept fixed unless the user chooses to shift them. |

### Vendors
| ID | Requirement |
|---|---|
| FR-VEN-01 | Users add, edit and remove vendors with category, name, contact phone and email (optional), status (shortlisted, booked, dropped) and notes. |
| FR-VEN-02 | Users add quotes with amount, pricing unit (total, per plate, per guest), units, inclusions and validity date. |
| FR-VEN-03 | The system compares quotes in a category by normalised total and per-guest cost and lists missing inclusions. |
| FR-VEN-04 | Removing a vendor keeps its expenses and unlinks them, after a confirmation that states the count. |

### Guests and schedule
| ID | Requirement |
|---|---|
| FR-GST-01 | Users record total expected guests, counts per diet group, allergy tags and accessibility needs. |
| FR-GST-02 | The system rejects diet totals above the guest total and reports diet groups not covered by any menu idea. |
| FR-SCH-01 | Users add, edit, delete and reorder schedule items per function (start time, duration, title, notes). |
| FR-SCH-02 | The system flags overlaps and items outside the function's time window. |

### Ideas and AI
| ID | Requirement |
|---|---|
| FR-IDEA-01 | An ideas board shows accepted theme, decor, menu and saving ideas. Users can add their own ideas and delete any idea. |
| FR-AI-01 | Users generate a plan draft. The draft is stored as a revision and shown as a reviewable list. |
| FR-AI-02 | Users regenerate or revise a plan with feedback text (max 500 characters). Each run creates a new revision. Earlier revisions stay readable. |
| FR-AI-03 | Users request targeted suggestions: budget split, tasks, theme and decor, menu, vendor categories, saving ideas, day-of schedule. |
| FR-AI-04 | Users accept selected items. Accepted items are validated again and written in one transaction. A confirmation lists what will change. |
| FR-AI-05 | Users reject items with an optional reason. Reasons are sent with later revisions. |
| FR-AI-06 | If AI fails, the user is told plainly and offered the standard template or a retry. Core features keep working without AI. |
| FR-AI-07 | AI never names real vendors and never presents prices as facts. Every money figure from AI is labelled "Estimate". |
| FR-AI-08 | Per-user limits: 10 generations per hour and 30 per day. |

### Export
| ID | Requirement |
|---|---|
| FR-EXP-01 | Users download CSV files of budget (categories and expenses) and tasks. |

## 7. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-01 | WCAG 2.2 AA for all screens ([ACCESSIBILITY.md](ACCESSIBILITY.md)). |
| NFR-02 | Non-AI API p95 latency under 500 ms on a warm instance [A]. |
| NFR-03 | AI generation completes or fails within 45 seconds, with visible progress. |
| NFR-04 | All arithmetic on money uses integer paise. No floating point. |
| NFR-05 | Every data access is scoped to the signed-in owner. |
| NFR-06 | No secrets in the frontend or repository. |
| NFR-07 | Works on the latest two versions of Chrome, Edge, Firefox and Safari, from 320px width. |
| NFR-08 | Core features run with zero AI spend. |
| NFR-09 | Hosting and database run on free tiers with no automatic billing ([ARCHITECTURE.md](ARCHITECTURE.md) §7). |
| NFR-10 | No personal data (guest names, phone numbers, emails, notes) is sent to the AI provider. |

## 8. Success metrics (for the demo and a pilot) [A]

- A new user creates an event and reaches the overview in under 3 minutes.
- Zero arithmetic mismatches between budget summary and the sum of expenses in tests.
- At least 50% of AI suggestions accepted in pilot sessions (measured from `ai_suggestion_items`).
- Zero serious or critical axe violations.

## 9. Acceptance criteria

Each FR maps to test cases in [TESTING.md](TESTING.md) §6. The release gate in TESTING.md §7 defines done.
