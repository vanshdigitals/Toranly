# Contributing

Project: Celebration & Event Planner (temporary name). Do not introduce a product name in code, UI copy or docs until the team decides one; use the config value `APP_DISPLAY_NAME` (default "Celebration & Event Planner").

## 1. Branches and commits

- `main` is always deployable. Work on `feat/<short-name>`, `fix/<short-name>`, `docs/<short-name>`.
- Conventional Commits: `feat(budget): add overrun warning`. One logical change per commit.
- Reference requirement ids in PR titles or bodies (for example FR-BUD-04).

## 2. Code standards

- Python: Ruff (lint and format), mypy strict for `app/domain` and `app/ai`. No floats for money. No I/O in `app/domain`.
- TypeScript: strict mode, ESLint, Prettier. API types generated from OpenAPI; do not hand-write them.
- Every repository method takes `owner_id`.
- Every AI output path goes through `ai/guards.py`.

## 3. Documentation

- Docs are the specification. A behaviour change updates the relevant doc in the same PR.
- Single source of truth: research in RESEARCH_REPORT.md, tokens in design/DESIGN_SYSTEM.md, endpoints in API.md, tables in DATABASE.md, AI contracts in AI_SCHEMAS.md. Other docs link instead of copying.
- Mark claims [V], [V-3P], [D], [E], [A] or [U] as defined in RESEARCH_REPORT.md §0.

## 4. Design rules enforced in review

- Tokens only; no raw HEX in components (Stylelint `color-no-hex` outside `tokens.css`).
- No gradients, no one-sided borders, no emoji icons, no nested cards.
- Icon-only buttons need `aria-label` (ESLint jsx-a11y).

## 5. Pull request checklist

- [ ] Linked requirement ids
- [ ] Tests added or updated; `pytest -m "not live"` and frontend tests pass locally
- [ ] Lint and type checks clean
- [ ] Accessibility: keyboard path checked; axe clean for touched screens
- [ ] No secrets, keys or personal data in code, fixtures or screenshots
- [ ] Docs updated
- [ ] New dependency justified
