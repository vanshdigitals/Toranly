# AI Schemas

Contract version: `1.0`. Python source of truth: `app/ai/contracts/` (Pydantic v2). JSON Schemas sent to xAI are generated from these models with `model_json_schema()` and checked in CI against the xAI supported subset (RR §8.1).
Related: [AI_SAFETY.md](AI_SAFETY.md), [API.md](API.md) E-70 to E-75, [DATABASE.md](DATABASE.md).

## 1. Provider request shape

Confirmed against docs.x.ai on 2026-10-28 (Structured Outputs guide and REST API reference): the Responses API accepts `text.format` with `type: "json_schema"`, `name`, `schema` and `strict: true`, and returns `usage.input_tokens` / `usage.output_tokens`. Implementation (`backend/app/ai/xai_client.py`, OpenAI Python SDK 3.40 with `base_url=XAI_BASE_URL`, SDK retries off):

```python
client.responses.create(
    model=settings.xai_model,                       # XAI_MODEL, default "grok-4.3"
    input=[{"role": "system", "content": SYSTEM_PROMPT},
           {"role": "user", "content": user_block},  # contract prompt + <user_data>{json}</user_data>
           # only on the repair retry:
           {"role": "user", "content": "Your previous reply did not match the JSON schema: ..."}],
    text={"format": {"type": "json_schema", "name": "theme_suggest", "strict": True,
                     "schema": xai_schema(contract)}},
    max_output_tokens=settings.ai_max_output_tokens,  # 2500
    store=False,                                      # do not keep the request at xAI
    timeout=min(AI_REQUEST_TIMEOUT_SECONDS, remaining budget),
)
```
No `tools` are ever sent. Fallback adapter (`XAI_API_STYLE=chat`): Chat Completions with `response_format={"type": "json_schema", "json_schema": {...}}` and `max_completion_tokens`. Status: the shape is documented [V]; the live smoke test (`pytest -m live`) ran on 2026-10-29 but every call was rejected for an invalid key before the request shape was evaluated, so acceptance by the account's model is still unverified.

Schema adaptation for xAI's documented subset (`xai_schema()`): Pydantic's `oneOf` for the item union becomes `anyOf` (xAI treats them the same), the OpenAPI `discriminator` keyword and `title`s are removed, and every object has `additionalProperties: false` with all properties required. `backend/tests/ai/test_contracts.py` checks every contract's schema against the subset (allowed keywords, `maxLength` ≤ 2048, `maxItems` ≤ 256, no unsupported regex features, no empty `enum`/`anyOf`). Each contract gets its own envelope that allows only its item kinds (§3), so a wrong kind fails validation instead of being filtered later.

### 1.1 Groq (fallback provider)

`backend/app/ai/groq_client.py`: Chat Completions at `GROQ_BASE_URL` with `response_format={"type": "json_schema", "json_schema": {"name": ..., "strict": true, "schema": groq_schema(schema)}}`, `max_completion_tokens` = `AI_MAX_OUTPUT_TOKENS` + 1024, `reasoning_effort="low"`, `include_reasoning=false`; no `store`, no tools. `groq_schema()` keeps only the keywords Groq documents for strict mode. The response is validated with the same strict Pydantic envelope as xAI output. Documented on console.groq.com (checked 2026-10-29); **not yet verified with a live call**. Failover rules: AI_SAFETY.md §10.

## 2. Input models

```python
class DietGroup(StrEnum): veg="veg"; non_veg="non_veg"; jain="jain"; eggetarian="eggetarian"; vegan="vegan"
class EventType(StrEnum): wedding="wedding"; engagement="engagement"; birthday="birthday"; anniversary="anniversary"; community="community"; family="family"

class EventPreferences(BaseModel):              # stored in events.preferences
    model_config = ConfigDict(extra="forbid")
    theme_words: list[constr(max_length=30)] = Field(default=[], max_length=5)
    diet_focus: list[DietGroup] = []
    customs: list[constr(max_length=40)] = Field(default=[], max_length=10)   # opt-in only
    avoid_colours: list[constr(max_length=20)] = Field(default=[], max_length=5)
    # notes removed: free-text notes never leave the browser (NFR-10)

class PlanContext(BaseModel):                   # built by the browser, re-validated and scrubbed by the server
    model_config = ConfigDict(extra="forbid")
    event_type: EventType
    month: constr(pattern=r"^\d{4}-\d{2}$")     # month only, not exact date
    days_until_event: conint(ge=0, le=1500)
    city: constr(max_length=80) | None
    guest_band: Literal["1-25","26-75","76-150","151-300","301-600","600+"]
    budget_total_inr: conint(ge=0)              # rupees, rounded down
    diet_counts: dict[DietGroup, conint(ge=0)]
    functions: list[constr(max_length=60)] = Field(max_length=10)
    preferences: EventPreferences
    existing_category_keys: list[str]
    existing_task_titles: list[constr(max_length=120)] = Field(max_length=200)
    rejected_reasons: list[constr(max_length=200)] = Field(max_length=20)
```
`feedback` (max 500) is a top-level field of `POST /api/v1/ai/suggest`, not part of `PlanContext`; the server adds it inside the same `<user_data>` block after scrubbing.
Never included: `preferences.notes` (removed in Phase 3, fixing the NFR-10 conflict), names, emails, phone numbers, vendor names or contacts, expense or task notes, the exact date (NFR-10). `extra="forbid"` rejects any such field with 422, and the server strips URLs, emails and phone numbers from every remaining string before sending (tested in `tests/ai/test_contracts.py` and `tests/ai/test_suggest.py`). In the stateless design the browser builds `PlanContext` (`web/src/lib/aiContext.ts`).

## 3. Contracts

| Contract | Purpose | Allowed item kinds | FR |
|---|---|---|---|
| plan.generate | First full draft | budget_share, task, theme_idea, decor_idea, menu_item, vendor_category | FR-AI-01 |
| plan.revise | Revise using feedback and rejected reasons | same as plan.generate | FR-AI-02 |
| budget.suggest | Budget split only | budget_share | FR-AI-03 |
| timeline.suggest | Tasks only | task | FR-AI-03 |
| theme.suggest | Theme and decor ideas | theme_idea, decor_idea | FR-AI-03 |
| menu.suggest | Menu ideas | menu_item | FR-AI-03 |
| vendors.categories | Vendor categories and questions to ask | vendor_category | FR-AI-03 |
| budget.savings | Saving ideas | saving_idea | FR-AI-03 |
| schedule.draft | Day-of schedule for one function | schedule_item | FR-AI-03 |

## 4. Output models

```python
class Envelope(BaseModel):
    model_config = ConfigDict(extra="forbid")
    contract_version: Literal["1.0"]
    items: list[Item] = Field(max_length=60)
    assumptions: list[constr(max_length=200)] = Field(max_length=10)
    warnings: list[constr(max_length=200)] = Field(max_length=10)
    refusal: constr(max_length=300) | None

Item = Annotated[Union[BudgetShare, TaskItem, ThemeIdea, DecorIdea, MenuItem,
                       VendorCategory, SavingIdea, ScheduleItem], Field(discriminator="kind")]

class BudgetShare(BaseModel):
    kind: Literal["budget_share"]
    category_key: constr(pattern=r"^[a-z_]{2,30}$")
    label: constr(max_length=40)
    share_pct: confloat(ge=0, le=100)          # converted to paise by the budget engine
    rationale: constr(max_length=300)

class TaskItem(BaseModel):
    kind: Literal["task"]
    title: constr(min_length=3, max_length=120)
    offset_days: conint(ge=0, le=730)          # days before event
    category_key: constr(pattern=r"^[a-z_]{2,30}$") | None
    is_milestone: bool
    depends_on_titles: list[constr(max_length=120)] = Field(max_length=5)

class ThemeIdea(BaseModel):
    kind: Literal["theme_idea"]
    title: constr(max_length=60)
    description: constr(max_length=300)
    palette_words: list[constr(max_length=20)] = Field(max_length=5)   # words, not hex codes

class DecorIdea(BaseModel):
    kind: Literal["decor_idea"]
    title: constr(max_length=60)
    description: constr(max_length=300)
    estimate_inr_min: conint(ge=0) | None
    estimate_inr_max: conint(ge=0) | None

class MenuItem(BaseModel):
    kind: Literal["menu_item"]
    course: Literal["welcome_drink","starter","main","bread_rice","dessert","beverage","snack"]
    dish_name: constr(max_length=60)
    diet_tags: list[DietGroup] = Field(min_length=1)
    allergen_notes: constr(max_length=120) | None

class VendorCategory(BaseModel):
    kind: Literal["vendor_category"]
    category_key: constr(pattern=r"^[a-z_]{2,30}$")
    label: constr(max_length=40)
    questions_to_ask: list[constr(max_length=120)] = Field(max_length=6)
    book_by_offset_days: conint(ge=0, le=730)

class SavingIdea(BaseModel):
    kind: Literal["saving_idea"]
    category_key: constr(pattern=r"^[a-z_]{2,30}$")
    idea: constr(max_length=200)
    estimate_saving_inr_min: conint(ge=0)
    estimate_saving_inr_max: conint(ge=0)
    trade_off: constr(max_length=200)

class ScheduleItem(BaseModel):
    kind: Literal["schedule_item"]
    function_name: constr(max_length=60)
    start_time: constr(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    duration_min: conint(ge=5, le=600)
    title: constr(max_length=80)
```
No item has a field for vendor names, phone numbers, addresses, URLs or booking status (FR-AI-07).

## 5. Validation pipeline

Every response passes all steps before it is stored or shown:

1. Provider status OK and output text present.
2. `json.loads` succeeds.
3. `Envelope.model_validate` succeeds (strict).
4. Item kinds are allowed for the contract (§3).
5. Consistency checks in `ai/guards.py`:
   - budget_share: shares sum to 95 to 105; the engine rescales to exactly 100% with largest-remainder rounding.
   - task: `offset_days` not greater than `days_until_event + 730`; tasks whose due date falls in the past are kept but flagged `warnings: past_due`; duplicate titles (case-insensitive, existing or within the response) are dropped; `depends_on_titles` that do not resolve are dropped; cycles are dropped.
   - menu_item: report diet groups with non-zero count and no dish.
   - estimates: min not greater than max, else swap; values above `budget_total_inr` are dropped.
   - schedule_item: `function_name` must match an existing function, else the item is dropped; overlaps become warnings.
   - Text fields: control characters stripped; URLs and email or phone patterns removed (AI_SAFETY.md §4).
6. Phase 3: items are returned to the browser (nothing is stored on the server). The browser keeps them pending until the user accepts or rejects them.

At apply time (E-73) each item is validated again against the current event state, because the event may have changed since generation.

## 6. Apply mapping

| Kind | Target | Rule |
|---|---|---|
| budget_share | budget_categories | Upsert by `category_key`. Allocation = share x total, rounded by the engine. Confirmation dialog shows old vs new allocation for every affected category |
| task | tasks | Insert with `source=ai`, `date_mode=relative` |
| theme_idea, decor_idea, menu_item, saving_idea | ideas | Insert with `source=ai` and estimate range in paise |
| vendor_category | budget_categories, tasks | Create category if missing (allocation 0) and a task "Shortlist {label} vendors" at `book_by_offset_days`, with questions in task notes |
| schedule_item | schedule_items | Insert into the matching function |

Completed tasks, expenses, vendors, quotes and guest counts are never modified by apply.

## 7. Failure and fallback

| Failure | Behaviour |
|---|---|
| Malformed JSON or schema failure | One repair retry with the validation error summary appended. Then fallback |
| `refusal` not null | Store revision `status=failed`, show refusal text neutrally, offer template |
| 429 | Honour `Retry-After` up to 10 s (2 s when absent), at most `AI_MAX_RETRIES_PER_PROVIDER` (1) retry inside the 45 s budget, then fail over; 503 `ai_busy` only when every provider is rate limited |
| 5xx or timeout (30 s per call) | One retry, then the next provider (Groq), then the standard template; 5 consecutive failures open that provider's circuit for 60 s |
| No credits or spending limit (xAI 403/429 with credit wording) | No retry; next provider; the provider cools down for `AI_FAILOVER_COOLDOWN_SECONDS` |
| Content-policy rejection | No retry and no failover; shown like a refusal |
| 401 or 403, or xAI's 400 "Incorrect API key provided" | No retry; alert in logs; that provider disabled until fixed (the next provider is used) |
| Fallback | For `plan.generate` and `timeline.suggest`: items built from `domain/templates.py`, `status=fallback`, label "Standard template". Other contracts: `status=failed`, no items, clear message. Also used when AI is disabled (no key, 401/403, circuit open) |
| Provider bucket empty on a retry | The retry waits for the bucket inside the 45 s budget; if it cannot, fallback/failed (the request was already admitted) |

## 8. Versioning

- `contract_version` is stored per revision. Breaking changes bump the major version and add a new model; old revisions remain readable through the old model.
- Prompts live in `backend/app/ai/prompts/{contract}.v1.txt` (plus `system.v1.txt`) and are covered by snapshot tests: `backend/tests/ai/test_prompts.py` compares the system prompt, the rendered user block for a fixed sample context and the xAI JSON Schema of every contract with `backend/tests/ai/snapshots/{contract}.v1.txt`. After an intentional change, review the diff and regenerate with `UPDATE_SNAPSHOTS=1 uv run pytest tests/ai/test_prompts.py`; a wording change that is not a typo fix gets a new `v2` file.
