# Research Report

Project: Celebration & Event Planner (temporary name, Challenge 5). Final product name and branding are undecided.
Research window: 24 to 26 October 2026. All access dates below are October 2026.

This report is the single source of truth for research evidence. Other documents cite its sections as `RR §n`.

## 0. Evidence labels

| Label | Meaning |
|---|---|
| [V] | Verified on an official or primary page during this research |
| [V-3P] | Consistent across reputable secondary sources, or an official page of a third party (for example Google Cloud docs describing Grok); the vendor's own page was not read |
| [D] | Project decision, justified in the text |
| [E] | Estimate that depends on stated assumptions |
| [A] | Assumption that must be validated |
| [U] | Unverified. Not confirmed this session. Implication stated next to it |

No user interviews, surveys or usability tests were conducted. All personas and UX outcomes are design hypotheses.

## 1. Product and competitor research

### 1.1 Comparison matrix

| Product | Event scope | Budget | Timeline / tasks | Vendors | Guests / dietary | Limitations observed (sourced only) | Source |
|---|---|---|---|---|---|---|---|
| The Knot | Weddings | Budget Advisor with location-based averages; editable categories [V] | Checklist sorted by wedding date [V] | Marketplace and vendor manager [V] | Guest list and RSVP [V] | US cost data; one weak aggregator source reports removal of features (unconfirmed) | theknot.com/wedding-budget; theknot.com/wedding-planning-app |
| Zola | Weddings | Tracker with allocation suggestions and payment reminders [V] | Checklist adjusts to wedding date [V] | Vendor recommendations [V] | Meal selections, plus-ones [V] | Seating chart and premium guest texting are paid add-ons per Zola's own article [V] | zola.com pages |
| WedMeGood | Indian weddings | Budget tool (self-described, not inspected) | Checklist from month 12 to month 1 [V] | Core strength: Indian vendor directory with reviews [V] | Family collaboration; AI consultant on Android [V] | Self-reported user counts differ between its own pages [V] | wedmegood.com; Google Play |
| Joy | Weddings | Not a focus in sources read | Not examined | Venue price checks mentioned in Joy blog [V-3P] | Connected guest list: labels, RSVPs, dietary requirements, import/export spreadsheets, admin collaborators [V] | Wedding-only | withjoy.com/guest-list; withjoy.com/faq |
| Partiful | Any social event (birthdays, dinners, weddings) [V] | No budget tool seen in sources | No task planning seen in sources | None | Link RSVP without app, guest questionnaires (for example dietary), text blasts, spot limits [V-3P] | Invite and RSVP centred, not a planning workspace | App Store listing; Partiful profile pages |
| Evite | Any event | None seen | None seen | None | Invitations with RSVP tracking, reminders [V] | Ads on free invitations and paid premium designs (user reviews on GetApp/Capterra) [V-3P]; premium priced per event [V-3P] | App Store listing; getapp.com; capterra |
| Aisle Planner, ShaadiSaga, Eventbrite, Notion/Google templates | n/a | n/a | n/a | n/a | n/a | Not researched [U]. No claims made | n/a |

### 1.2 Patterns found

1. Wedding tools integrate budget, date-driven checklist, vendors and guests in one place (The Knot, Zola, WedMeGood).
2. General event tools (Partiful, Evite) focus on invitations and RSVP, not on budgets or task timelines.
3. Date-relative checklists are the common timeline pattern (The Knot, Zola, WedMeGood).
4. Dietary data is captured per guest at RSVP time (Zola, Joy, Partiful questionnaires).

### 1.3 Realistic differentiators [D]

These are gaps in the products sampled, not claims of global uniqueness.

1. One planner for weddings, birthdays, anniversaries, community events and family celebrations, with INR and Indian number formatting built in.
2. Deterministic budget engine: allocation totals, overrun warnings and quote comparison computed in Python and tested.
3. AI suggestions arrive as a reviewable list. Nothing is written until the user accepts each item.
4. Dietary coverage check: the menu must cover every diet group with a non-zero count.

### 1.4 MVP scope [D]

| ID | Feature |
|---|---|
| F1 | Event setup (type, date, city, guests, budget, preferences, optional sub-functions) |
| F2 | Budget: categories, allocations, expenses, overrun detection |
| F3 | Timeline and tasks: template tasks relative to event date, dependencies, completion, date-change preview |
| F4 | Vendors and quotes: per-category vendors, quotes, deterministic comparison |
| F5 | Guests and dietary summary (aggregate counts, not individual guests) |
| F6 | Day-of schedule per function |
| F7 | AI plan review: generate, regenerate, accept or reject items; ideas board for accepted themes, decor and menu ideas |
| F8 | CSV export of budget and tasks |

Deferred: individual guest list and RSVP website, invitations, vendor marketplace, payments, seating charts, multi-user collaboration, WhatsApp, image generation, dark theme, PDF export, native apps, Hindi UI (font stack is ready; strings deferred).

## 2. Event-planning domain (configurable templates)

| Event type | Default lead time | Default budget categories | Notes |
|---|---|---|---|
| Wedding | 300 days [A] | Venue, Catering, Decor, Attire & jewellery, Photo & video, Entertainment, Invitations, Gifts & favours, Travel & stay, Ritual items, Contingency | Sources disagree: about 6 months average per WeddingWire India editor quoted by The Knot [V]; 9 to 18 months in Indian planning guides [V-3P]. Template uses 300 days and is editable |
| Engagement | 60 days [A] | Venue, Food, Decor, Attire, Gifts, Contingency | |
| Birthday | 30 days [A] | Venue, Food, Cake, Decor, Entertainment, Return gifts, Contingency | |
| Anniversary | 30 days [A] | Venue & food, Decor, Gifts, Photo, Contingency | |
| Community event | 60 days [A] | Venue & permits, Sound & AV, Food, Seating, Publicity, Safety, Contingency | Add walk-in buffer field |
| Family celebration | 30 days [A] | Venue, Food, Decor, Gifts, Contingency | |

Rules [D]:
- Default contingency is 10% [A], editable.
- Indian wedding sequencing from guides: fix 2 to 3 date options, decide functions, book venue, then photographer and caterer [V-3P]. Used only for template task order.
- Per-plate catering prices found in vendor blogs are not used anywhere in the product.
- Diet groups: veg, non-veg, Jain, eggetarian, vegan; allergies as free tags. Customs and religion are opt-in toggles, never inferred from names or city.

## 3. UX research summary

Decisions and their basis. Full behaviour is in [UX_FLOWS.md](UX_FLOWS.md).

| Topic | Decision [D] | Basis |
|---|---|---|
| Navigation | Desktop sidebar from 1024px; bottom bar with 5 items under 768px | Common pattern in competitor apps sampled; keeps primary sections one tap away |
| Wizard | 4-step create flow with saved progress | Progressive disclosure; reduces form length per step |
| AI changes | Review list with per-item accept/reject; nothing auto-applied | Human-in-the-loop requirement; OWASP LLM06 Excessive Agency [V-3P] |
| Dialogs | Modal focus trap, return focus to trigger | WAI-ARIA APG modal dialog pattern [U: page not re-read; behaviour is widely documented] |
| Status | Live region for saves and completions | WCAG 2.2 SC 4.1.3 [V] |
| Dragging | No drag-only actions; up/down buttons | WCAG 2.2 SC 2.5.7 [V] |

No NN/g articles were read this session [U]. Implication: UX choices rest on standards and competitor patterns, not published usability studies.

## 4. Colour research

### 4.1 Method

Palettes were judged on: emotional fit with the brief (warm, joyful, celebratory, trustworthy, elegant), the hard constraints (no gradients, no neon, no pink or red dominance, no washed-out pastels), suitability beyond weddings, and computed WCAG contrast.

Colour-emotion associations and Indian cultural colour meanings could not be verified from academic sources this session [U]. Implication: the emotional reasoning below is design judgment. Validate with a 5-person preference test before the final submission.

### 4.2 Candidates

| Criterion | A. Marigold, Teal and Rani (selected) | B. Rose and Champagne | C. Peacock and Saffron |
|---|---|---|---|
| Roles | Teal #0F6E6E structure; marigold #F2A93B celebration fills; rani #B83A6B sparse highlight | Rose primary; champagne #E9C98B accent | Peacock blue #1F4E9C primary; saffron #F28C28 accent |
| Emotional read | Warm joy (marigold) anchored by calm trust (teal); rani adds affection in small doses | Romantic, wedding-only | Bright festival energy, strong |
| Pink/red dominance | Pass (rani limited to under 5% of a screen) | Fail (rose leads) | Pass |
| Washed-out risk | Low | High (champagne is low-saturation) | Low |
| Neon/childish risk | Low | Low | Medium (two highly saturated hues compete for attention) |
| Contrast | White on teal 6.04:1; ink on marigold 7.86:1; white on rani 5.45:1 | Not computed (rejected on constraints) | White on peacock 7.99:1; ink on saffron 6.39:1 |
| Fit beyond weddings | Yes | Weak | Yes |

### 4.3 Re-assessment and decision [D]

The earlier Marigold & Teal palette passed every readability check but leaned calm. To better carry joy and celebration without pink dominance:
- Keep teal as the trust anchor and marigold as the celebration colour.
- Replace the muddy henna accent (#A4532B) with rani #B83A6B, used only for milestone chips, the event countdown and illustrations.
- Add tinted subtle surfaces (marigold-subtle #FFF3DC, primary-subtle #E6F2F2) so screens feel warm, not grey.

Full tokens and contrast tables: [design/DESIGN_SYSTEM.md](design/DESIGN_SYSTEM.md) §2. Ratios were computed with the WCAG 2.x relative-luminance formula by a script during this research.

## 5. Typography research

| Pairing | Heading personality | Numbers in tables | Devanagari | Licence | Verdict |
|---|---|---|---|---|---|
| 1. Fraunces + Inter | Warm, editorial serif | Inter offers tabular figures (tnum) [V: rsms.me Inter site] | Needs Noto fallback | Inter OFL [U]; Fraunces OFL [U] | Good, but Inter reads neutral and corporate for a celebration product |
| 2. Fraunces + Plus Jakarta Sans | Warm serif headings, friendly geometric UI | Tabular figures added in v2.7 per the official repository changelog [V] | Needs Noto fallback | OFL [U: licence file not opened] | **Selected** |
| 3. Poppins (single family) | Friendly geometric | Not verified | Native Latin and Devanagari, by Indian Type Foundry [V] | OFL [V] | Fewer files, but round geometric digits are less clear in dense tables [A] |
| 4. Playfair Display + Source Sans 3 | Classic romantic | Not checked | None | Not checked | Rejected: too wedding-romantic |

Devanagari fallback: Noto Sans Devanagari, OFL 1.1 [V: Fontsource licence text].

Implications of [U] items: confirm OFL text for Fraunces and Plus Jakarta Sans and confirm the Google Fonts build of Plus Jakarta Sans exposes `tnum` before implementation (IMPLEMENTATION_PLAN.md task P0-3). Fallback if `tnum` is missing: use Inter for numeric table cells only.

## 6. Iconography

Lucide is selected [D].
- Licence: ISC, with Feather-derived icons under MIT. Copyright notice must be kept when redistributing the icon source [V: lucide.dev/license].
- Official React package `lucide-react` exists [V: GitHub README].
- Implication: include Lucide's LICENSE text in the repository's third-party notices.

Icon map: [design/DESIGN_SYSTEM.md](design/DESIGN_SYSTEM.md) §5.

## 7. Accessibility and motion standards

- WCAG 2.2 SC 2.5.8 Target Size (Minimum) 24 by 24 CSS px [V].
- SC 2.3.3 Animation from Interactions is Level AAA; technique C39 uses `prefers-reduced-motion` [V: W3C]. The project adopts it as a project rule even though AA does not require it [D].
- SC 2.2.2 Pause, Stop, Hide applies to any motion over 5 seconds [V-3P]. The product has no auto-playing motion over 5 seconds [D].

## 8. Technical evaluations

### 8.1 xAI Grok API

| Claim | Status | Source |
|---|---|---|
| Base URL `https://api.x.ai/v1`, OpenAI SDK compatible, Bearer auth | [V] | docs.x.ai debugging and getting-started pages |
| Responses API recommended; Chat Completions legacy | [V] (previous session) | docs.x.ai comparison page |
| Responses are stored server-side for 30 days | [V] (previous session) | docs.x.ai |
| grok-4.3: $1.25 / $2.50 per 1M input/output tokens, 1M context | [V] (previous session, official migration guide); reconfirmed by third parties citing docs.x.ai in Oct 2026 | docs.x.ai; anotherwrapper.com |
| grok-4.7: $2.00 / $6.00, 500K context, released 21 Sep 2026 | [V] (previous session); [V-3P] release date | docs.x.ai; developersdigest.tech |
| Structured output on Responses API uses `text.format = {type: "json_schema", name, strict, schema}` | [V-3P] Google Cloud's official docs for Grok models show this exact shape | docs.cloud.google.com Grok structured output |
| JSON Schema subset; `additionalProperties` defaults to false; string length limits up to 2,048 | [V] (previous session) | docs.x.ai structured outputs |
| Error codes 400, 401, 403, 404, 405, 415, 422, 429; 202 for deferred completions; status page status.x.ai | [V] | docs.x.ai/developers/debugging |
| 500 and 503 handling | [V-3P] | copy of xAI debugging doc on glama.ai |
| Rate limits per model, RPS = RPM/48 (min 2), 429 on excess | [V] (previous session) | docs.x.ai rate limits |
| `store: false` opt-out | [U] | Implication: assume prompts are retained 30 days; send no personal data |
| Free API credits | [U] | Implication: budget real money for AI calls (see §8.5) |
| Usage policy details | [U] | Implication: read xAI terms before public launch |

The xAI structured-outputs page could not be fetched directly this session (tool restriction). Decision [D]: implement `text.format`; the integration smoke test (TESTING.md T-AI-SMOKE) must pass before any AI feature is enabled. If xAI rejects `text.format`, switch the provider adapter to Chat Completions `response_format`, which the previous session verified on docs.x.ai.

### 8.2 Database

| Option | Facts | Verdict |
|---|---|---|
| Neon Postgres Free | $0/month; 100 projects; 10 branches per project; 100 CU-hours per project per month; 0.5 GB storage per project; 5 GB public transfer per project per month; scale to zero after 5 min idle; no credit card; compute suspends until next month when a limit is hit [V: neon.com pricing and FAQ pages] | **Selected** |
| Cloudflare D1 | Third-party SQLAlchemy dialect over REST with no transactions [V: PyPI, previous session] | Rejected: budget writes need transactions |
| Render Postgres Free | Expires 30 days after creation, then deleted after grace period [V-3P] | Rejected |
| SQLite | Local file | Local experiments only; all tests and CI use Postgres to avoid dialect drift |
| Supabase | Not evaluated, not required | Not used |

[E] An event with about 40 tasks, 15 categories, 30 expenses, 10 vendors and 5 AI revisions uses well under 1 MB. 0.5 GB comfortably fits a demo.
Billing risk: none on Free (compute suspends; it does not bill) [V].

### 8.3 Hosting

| Platform | Facts | Billing risk | Verdict |
|---|---|---|---|
| Render Free web service | Spins down after 15 min without traffic; about 1 min to spin up; 750 free instance hours per workspace per month; ephemeral filesystem; may restart at any time; not for production [V: render.com/docs/free]. No credit card required per Render's own article [V], though one community thread reports a card prompt [V-3P] | None on free instances: services suspend at limits [V-3P: Render community staff] | **Selected** for the demo |
| Google Cloud Run | Request-based free tier 180,000 vCPU-s, 360,000 GiB-s, 2M requests per month; max timeout 60 min [V, previous session]. A valid Cloud Billing account is required even for free-tier use [V: Cloud Billing docs]. Free tier applies per billing account and in specific regions [V-3P] | Real: usage beyond free tier is charged to the linked payment method; budget alerts notify but do not cap [A] | Alternative only when a billing account already exists |
| Koyeb | 1 free instance, 512 MB, scale to zero after 1 h [V, previous session] | Signup restriction report unconfirmed [U] | Backup option |
| Fly.io | No free tier for new organisations [V] | Card required | Rejected |
| Vercel Hobby | Non-commercial only; 300 s max duration [V] | | Rejected for API |
| Hugging Face Docker Spaces | Need a paid plan [V] | | Rejected |

Cloud Run reassessment [D]: it is technically excellent but needs a billing account with a payment method, adds container registry and IAM setup, and carries uncapped overage risk. For a budget-constrained student project, Render Free plus Neon Free has zero billing exposure. The cost is a cold start of about one minute; mitigation is in [ARCHITECTURE.md](ARCHITECTURE.md) §7.

Single-origin decision [D]: FastAPI serves the built React app as static files. Reason: the frontend and API share one origin, so session cookies work without third-party cookie rules, and CORS is only needed for local development.

### 8.4 Python stack (Oct 2026)

| Package | Latest seen | Pin | Status |
|---|---|---|---|
| Python | 3.15.1 (21 Oct 2026); 3.14 in bugfix | 3.14 | [V] python.org |
| FastAPI | 0.162.0 | ~=0.162 | [V] release notes |
| Pydantic | 2.14.1 | ~=2.14 | [V] pydantic.dev |
| SQLAlchemy | 2.1.6 | ~=2.1 | [V] sqlalchemy.org |
| psycopg 3 | n/a | pin at scaffold | [U] version; dialect support [V] |
| Alembic, HTTPX/openai SDK, pytest, Ruff, mypy, argon2-cffi | n/a | pin at scaffold | [U] |

Implication of [U]: P0 scaffold task records exact versions in a lock file and TRD.md.

### 8.5 AI cost estimate [E]

Assume one full plan generation uses 3,000 input and 3,000 output tokens on grok-4.3: 3,000 x $1.25/1M + 3,000 x $2.50/1M = about $0.011. With the per-user cap of 30 generations per day and 200 total demo generations, spend is about $2.25. Real token counts must be measured in the smoke test.

## 9. Unresolved research gaps

| Gap | Implication | Owner task |
|---|---|---|
| Aisle Planner, ShaadiSaga, Eventbrite not researched | Competitor matrix incomplete; README claims limited to sampled products | Optional |
| xAI structured-outputs page not read directly; `store=false`; free credits; usage policy | Smoke test gates AI; no personal data in prompts | P0-4 |
| Fraunces and Plus Jakarta Sans licence files; `tnum` in Google Fonts build | Fallback font plan defined | P0-3 |
| Colour-emotion and Indian colour symbolism sources | Treat palette emotion as hypothesis; run preference test | P5-4 |
| Render card prompt reports | Have Koyeb as backup | P0-5 |
| Docker base image `python:3.14-slim` availability on Render | Verify in first deploy | P0-5 |
| APG dialog page not re-read | Use a vetted library (React Aria) that implements APG | P2 |

## 10. References (accessed October 2026)

| # | Title | URL | Supports |
|---|---|---|---|
| R1 | Neon Pricing Plans | https://neon.com/pricing | DB choice |
| R2 | Neon FAQ: Free plan limits and quotas | https://neon.com/faqs/free-plan-limits-and-quotas | DB limits |
| R3 | Neon FAQ: managed Postgres free tier | https://neon.com/faqs/managed-postgres-databases-free-tier | Scale to zero, no card |
| R4 | Render: Deploy for Free | https://render.com/docs/free | Hosting |
| R5 | Render: platforms with a real free tier (Render article) | https://render-www.onrender.com/articles/platforms-with-a-real-free-tier-for-developers-in-2026 | No card |
| R6 | Render community: accidental charges | https://community.render.com/t/is-there-a-chance-of-accidentally-racking-up-charges-by-mistake/17841 | Billing risk |
| R7 | Google Cloud Billing documentation | https://docs.cloud.google.com/billing/docs | Billing account required |
| R8 | Cloud Run pricing | https://cloud.google.com/run/pricing | Free tier |
| R9 | xAI Debugging Errors | https://docs.x.ai/developers/debugging | Error codes |
| R10 | Google Cloud: Structured output for Grok models | https://docs.cloud.google.com/vertex-ai/generative-ai/docs/partner-models/grok/capabilities/structured-output | `text.format` shape |
| R11 | xAI Models and pricing | https://docs.x.ai/developers/models | Models, prices |
| R12 | xAI Structured Outputs | https://docs.x.ai/developers/model-capabilities/text/structured-outputs | Schema subset |
| R13 | xAI Rate Limits | https://docs.x.ai/developers/rate-limits | 429 handling |
| R14 | Grok 4.3 vs 4.7 pricing comparison | https://anotherwrapper.com/tools/llm-pricing/grok-4.7/grok-4.3 | Price reconfirmation |
| R15 | Lucide License | https://lucide.dev/license | Icon licence |
| R16 | Lucide GitHub | https://github.com/lucide-icons/lucide | Packages |
| R17 | Plus Jakarta Sans repository | https://github.com/tokotype/PlusJakartaSans | Tabular figures |
| R18 | Inter (rsms.me) | https://d.rsms.me/inter-website/v3 | Inter tnum |
| R19 | Poppins on fontinfo.opensuse.org | https://fontinfo.opensuse.org/fonts/PoppinsBold.html | Devanagari, OFL |
| R20 | Noto Sans Devanagari on Fontsource | https://fontsource.org/fonts/noto-sans-devanagari/about | OFL |
| R21 | WCAG 2.2 | https://www.w3.org/TR/WCAG22/ | Target size, focus |
| R22 | Understanding SC 2.3.3 | https://w3c.github.io/wcag/understanding/animation-from-interactions.html | Motion |
| R23 | Technique C39 | https://www.w3.org/WAI/WCAG22/Techniques/css/C39.html | Reduced motion |
| R24 | OWASP Top 10 for LLM Applications 2025 | https://owasp.github.io/www-project-top-10-for-large-language-model-applications/assets/PDF/OWASP-Top-10-for-LLMs-v2025.pdf | AI safety |
| R25 | The Knot budget | https://www.theknot.com/wedding-budget | Competitor |
| R26 | Zola planning app | https://www.zola.com/wedding-planning/app | Competitor |
| R27 | WedMeGood app | https://www.wedmegood.com/download-app | Competitor |
| R28 | Joy guest list | https://withjoy.com/guest-list/ | Competitor |
| R29 | Partiful App Store | https://apps.apple.com/app/id1662982304 | Competitor |
| R30 | Evite App Store | https://apps.apple.com/app/id431685286 | Competitor |
| R31 | Evite reviews, GetApp | https://www.getapp.com/marketing-software/a/evite/ | Competitor limitations |
| R32 | The Knot Indian wedding planning | https://www.theknot.com/content/indian-wedding-planning | Lead time |
| R33 | Indian wedding planning checklist | https://www.weddingplanning.in/guides/indian-wedding-planning-checklist.php | Sequencing |
| R34 | Python versions | https://devguide.python.org/versions/ | Pin |
| R35 | FastAPI release notes | https://fastapi.tiangolo.com/release-notes/ | Pin |
| R36 | Pydantic 2.14 release | https://pydantic.dev/articles/pydantic-v2-14-release | Pin |
| R37 | SQLAlchemy download | https://www.sqlalchemy.org/download.html | Pin |
| R38 | sqlalchemy-cloudflare-d1 | https://pypi.org/project/sqlalchemy-cloudflare-d1/ | Reject D1 |
| R39 | Fly.io pricing | https://fly.io/docs/about/pricing/ | Reject |
| R40 | Hugging Face Spaces overview | https://huggingface.co/docs/hub/en/spaces-overview | Reject |
