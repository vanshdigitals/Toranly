# Design System

Project: Celebration & Event Planner (temporary name). Product name, logo and brand identity are undecided; this system defines UI tokens only.
Research basis: [RESEARCH_REPORT.md](../RESEARCH_REPORT.md) §4 to §7. Accessibility rules: [ACCESSIBILITY.md](../ACCESSIBILITY.md).
Tokens are implemented once as CSS custom properties in `web/src/styles/tokens.css`. Components use tokens only; raw HEX values in components fail lint (CONTRIBUTING.md §4).

## 1. Principles and emotional direction

Target feeling: joyful, warm, celebratory, positive, modern and trustworthy, without looking childish, romantic-only, corporate or dated.

1. Calm surfaces, joyful moments. Large areas stay light and warm. Saturated colour marks moments that matter: milestones, completion, the countdown, primary actions.
2. Numbers are serious. Budget and dates use the UI font with tabular figures, never decorative type.
3. Status is never colour alone. Every status pairs an icon and text.
4. Flat colour only. No gradients, glows, glass effects, floating shapes or sparkle decorations.
5. Hierarchy through type, spacing and alignment, not boxes inside boxes.

## 2. Colour

### 2.1 Palette decision

Selected: Marigold, Teal and Rani (comparison in RR §4.2). Teal gives structure and trust; marigold gives celebration; rani gives warmth and affection in small doses (under 5% of any screen). Pink and red never lead.

### 2.2 Tokens

| Token | HEX | Role |
|---|---|---|
| `--color-primary` | #0F6E6E | Primary buttons, links, active nav, progress |
| `--color-primary-hover` | #0B5858 | Hover |
| `--color-primary-active` | #084646 | Pressed |
| `--color-primary-subtle` | #E6F2F2 | Selected rows, active nav background |
| `--color-secondary` | #3E4C9A | Secondary data series, focus ring |
| `--color-celebration` | #F2A93B | Fills only: milestone chips, completion burst, countdown badge background. Always with ink text |
| `--color-celebration-subtle` | #FFF3DC | Starter-plan card, highlight surfaces |
| `--color-celebration-text` | #8A5A00 | Marigold-family text on light surfaces |
| `--color-accent` (rani) | #B83A6B | Countdown number, milestone icon, sparse highlights |
| `--color-bg` | #FBF8F3 | Page background |
| `--color-surface` | #FFFFFF | Cards, dialogs, tables |
| `--color-surface-subtle` | #F4EFE6 | Table headers, zebra rows |
| `--color-text` | #1E2330 | Body and headings |
| `--color-text-secondary` | #474F5E | Labels, metadata |
| `--color-text-muted` | #646B78 | Hints, placeholders |
| `--color-border` | #E3DCCF | Decorative dividers, card outlines |
| `--color-border-strong` | #8C8577 | Input borders, secondary button outline |
| `--color-success` / `-bg` | #1E7A46 / #E8F5EC | Within budget, done |
| `--color-warning` / `-bg` | #8A5A00 / #FDF3E1 | Near limit (90% or more) |
| `--color-error` / `-bg` | #B42318 / #FDECEA | Over budget, validation |
| `--color-info` / `-bg` | #2457A6 / #EAF1FB | Tips, "Estimate" chip |
| `--color-focus` | #3E4C9A | 2px outline, 2px offset |
| `--color-disabled-text` / `-bg` | #8C8577 / #EDE8DF | Disabled controls |

### 2.3 Contrast (computed with the WCAG 2.x formula)

| Pair | Ratio | Use |
|---|---|---|
| text on surface | 15.69:1 | Body |
| text on bg | 14.81:1 | Body |
| text on celebration-subtle | 14.28:1 | Card text |
| text on primary-subtle | 13.71:1 | Selected row |
| text-secondary on surface | 8.24:1 | Labels |
| text-secondary on celebration-subtle | 7.50:1 | Labels |
| text-muted on surface | 5.36:1 | Hints |
| text-muted on surface-subtle | 4.68:1 | Do not lighten |
| white on primary | 6.04:1 | Primary button |
| primary on surface | 6.04:1 | Links, secondary button text |
| primary on primary-subtle | 5.28:1 | Active nav label |
| primary on celebration-subtle | 5.50:1 | Link in starter card |
| white on secondary | 7.76:1 | |
| text on celebration | 7.86:1 | Milestone chip |
| celebration on bg | 1.89:1 | Fails: never use marigold as text or sole indicator |
| celebration-text on celebration-subtle | 5.39:1 | |
| white on accent (rani) | 5.45:1 | Countdown badge alt |
| accent on surface | 5.45:1 | Countdown number |
| success on success-bg | 4.76:1 | Status chip |
| warning on warning-bg | 5.39:1 | Status chip |
| error on error-bg | 5.75:1 | Status chip |
| info on info-bg | 6.18:1 | Estimate chip |
| white on error | 6.57:1 | Danger button |
| border-strong on surface | 3.66:1 | Input boundary (3:1 non-text) |
| border-strong on celebration-subtle | 3.33:1 | Input inside starter card |
| focus on bg | 7.33:1 | Focus ring |
| border on surface | 1.36:1 | Decorative only |

### 2.4 Usage rules

- Large surfaces: bg and surface only.
- One primary button per view region.
- Marigold appears at most in milestones, completion feedback, the countdown badge and the starter card.
- Charts: series 1 primary, series 2 secondary, series 3 celebration (with direct labels), series 4 accent. Never more than 4 series.

## 3. Typography

Selected system (RR §5): Fraunces for celebratory headings, Plus Jakarta Sans for all UI, Noto Sans Devanagari as script fallback. Self-hosted WOFF2 subsets via Fontsource packages [D]. Licences to confirm in P0-3.

| Role | Family and weight | Size / line height (rem) | Letter spacing |
|---|---|---|---|
| display | Fraunces 600 | 2.25 / 1.15 | -0.01em |
| h1 | Fraunces 600 | 1.75 / 1.2 | 0 |
| h2 | Fraunces 600 | 1.375 / 1.3 | 0 |
| h3 | Plus Jakarta Sans 700 | 1.125 / 1.4 | 0 |
| body | Plus Jakarta Sans 400 | 1 / 1.55 | 0 |
| body-strong | Plus Jakarta Sans 600 | 1 / 1.55 | 0 |
| label | Plus Jakarta Sans 500 | 0.875 / 1.45 | 0.005em |
| small | Plus Jakarta Sans 400 | 0.875 / 1.45 | 0 |
| caption | Plus Jakarta Sans 500 | 0.75 / 1.4 | 0.01em; never for essential info |
| number | Plus Jakarta Sans 600, `font-variant-numeric: tabular-nums lining-nums` | inherits | 0 |

Fallback stacks:
- Display: `"Fraunces", Georgia, "Noto Serif Devanagari", serif`
- UI: `"Plus Jakarta Sans", system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Devanagari", sans-serif`

Rules: Fraunces only for h1, h2 and display. Tables, forms, money and dates use the UI font. Money right-aligned. Base size 16px; users can zoom to 200% without loss (ACCESSIBILITY.md §5). Load weights: Fraunces 600; Jakarta 400, 500, 600, 700; Devanagari 400 and 600 with `unicode-range` so it downloads only when Devanagari text renders. `font-display: swap`.

Formatting: INR via `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })` producing ₹12,34,567. Compact: ₹12.3 L, ₹1.2 Cr, only in summary cards, with full value in `aria-label` and tooltip. Dates: `14 Feb 2027`; times 24 h `18:30` [D, avoids AM/PM ambiguity in schedules].

## 4. Spacing, grid and layout

- Spacing scale (px): 4, 8, 12, 16, 20, 24, 32, 40, 48, 64. Tokens `--space-1` to `--space-10`.
- Breakpoints (from layout needs): 640px (tables reflow), 768px (bottom bar to rail), 1024px (full sidebar), 1280px (content max width 1120px).
- Grid: mobile 4 columns, 16px margins, 16px gutters; tablet 8 columns, 24px margins; desktop 12 columns, 32px margins, 24px gutters.
- Page structure: page title row (h1 and primary action), then sections separated by 32px with h2 headings. Sections sit on the bg; tables and lists sit on surface panels with 1px border. No card inside a card.

## 5. Icons

Library: Lucide (`lucide-react`), ISC licence (RR §6). Size 20px in UI, 24px in nav, stroke 2 (library default). Colour inherits text colour.

| Purpose | Icon | Purpose | Icon |
|---|---|---|---|
| Overview | `house` | Edit | `pencil` |
| Budget | `wallet` | Delete | `trash-2` |
| Timeline / tasks | `list-checks` | Search (event selector) | `search` |
| Calendar, dates | `calendar-days` | Filter | `list-filter` |
| Change date | `calendar-clock` | Download | `download` |
| Vendors | `store` | Add | `plus` |
| Guests | `users` | Row actions | `ellipsis` |
| Schedule | `clock` | Close | `x` |
| AI plan, ideas | `lightbulb` | Back | `arrow-left` |
| Settings | `settings` | Success | `circle-check` |
| Account | `circle-user` | Warning | `triangle-alert` |
| Sign out | `log-out` | Error | `circle-alert` |
| Notifications | `bell` (reserved; no notifications in MVP) | Info, Estimate | `info` |
| Show/hide password | `eye` / `eye-off` | Milestone | `flag` |
| Wedding | `heart-handshake` | Birthday | `cake` |
| Engagement | `gem` | Anniversary | `heart` |
| Community | `tent` | Family | `house-heart` |

Icon names must be confirmed against lucide.dev during P2 [U]; substitutes must keep the same meaning. Rules: decorative icons `aria-hidden="true"`; icon-only buttons have `aria-label` naming action and object and a matching tooltip; no emoji, text arrows or improvised symbols.

## 6. Shape and elevation

| Token | Value | Applies to |
|---|---|---|
| `--radius-pill` | 999px | Primary buttons, chips, segmented controls, bottom-bar active indicator |
| `--radius-md` | 12px | Secondary buttons, inputs, selects, menus, toasts, table panels |
| `--radius-lg` | 16px | Cards, panels, drawers (inner edge) |
| `--radius-xl` | 20px | Dialogs, mobile sheets (top corners) |
| `--radius-sm` | 6px | Checkboxes, focus ring follows component radius |
| circle | 50% | Icon-only buttons, avatars |
| `--shadow-overlay` | 0 8px 24px rgba(30, 35, 48, 0.12) | Dialogs, drawers, menus, toasts only |

Borders: 1px full borders only. No one-sided accent borders. Cards have no shadow.

## 7. Components

### Buttons

| Variant | Shape | Default | Hover | Active | Disabled |
|---|---|---|---|---|---|
| Primary | pill, height 44px, padding 0 20px, label 600 | bg primary, white text | primary-hover | primary-active, scale 0.98 | disabled tokens |
| Secondary | radius-md, height 44px, 1px border-strong | surface bg, primary text | bg primary-subtle | bg #D5E8E8 [A], scale 0.98 | disabled tokens |
| Tertiary | text only, underline on hover | primary text | underline | primary-active text | disabled text |
| Danger | pill | bg error, white text | darken 8% (#9A1E15) [A] | scale 0.98 | disabled tokens |
| Icon | circle, 40px (44px under 768px) | transparent | bg surface-subtle | bg border | disabled text |

Busy state: label stays, spinner (16px) replaces the leading icon, `aria-busy="true"`, button disabled. Min target 44 by 44 on touch layouts.

### Inputs
Height 44px, radius-md, 1px border-strong, surface bg, label above (label token), helper text below (small, text-secondary). Focus: focus ring. Error: border error 2px, icon `circle-alert` and message in error colour below, `aria-invalid` and `aria-describedby`. Money inputs show "₹" prefix and a live formatted preview. Number steppers have minus and plus icon buttons.

### Chips and status
Pill, height 28px, label token. Status chips: icon plus text, colours from §2.2 bg/text pairs. "Estimate" chip uses info. Milestone chip: celebration fill, text colour, `flag` icon.

### Navigation
Sidebar: surface bg, 1px right border is the panel edge (full-height panel border, not a decorative accent). Items 44px, radius-md, active item bg primary-subtle with primary text and icon, `aria-current="page"`. Bottom bar: surface, top border, 5 items, active label 600 with pill indicator behind the icon.

### Dialogs, drawers, toasts
Dialog: max width 560px, radius-xl, overlay rgba(30, 35, 48, 0.48), title h2, actions bottom-right (primary last). Mobile: full-width sheet from bottom. Drawer: right side, 440px desktop, full screen under 768px. Toasts: radius-md, surface with 1px border and overlay shadow, icon plus text, optional action.

### Tables and budget summaries
Header row surface-subtle, 48px rows, numbers right-aligned tabular, status column icon plus text. Summary bar: label over value pairs. Budget bar: horizontal, track surface-subtle, committed fill primary. Overspend shows as a separate solid error segment at the end of the bar plus the text "Over by ₹1,75,000". No patterns or gradients.

### Empty, loading, error, success
- Empty: heading, one sentence, one primary action, optional secondary. No illustrations in MVP [D].
- Loading: skeleton blocks in surface-subtle, static under reduced motion.
- Error panel: error-bg surface with radius-lg, icon, title, message, Retry (secondary).
- Success: toast plus inline state change.

## 8. Motion

| Token | Duration | Easing | Use |
|---|---|---|---|
| `--motion-fast` | 120ms | cubic-bezier(0.2, 0, 0, 1) | Button hover and press, checkbox tick |
| `--motion-base` | 200ms | cubic-bezier(0.2, 0, 0, 1) | Inline expand, validation message, budget value cross-fade |
| `--motion-enter` | 240ms | cubic-bezier(0, 0, 0.2, 1) | Dialog, drawer, toast enter (fade plus 8px translate) |
| `--motion-exit` | 160ms | cubic-bezier(0.4, 0, 1, 1) | Exit |
| `--motion-celebrate` | 400ms once | ease-out | Task done: check scales 0.8 to 1 and a marigold ring fades |

Rules: no page transitions (route change is instant; focus moves to h1). No count-up numbers. No looping animation except the AI progress bar (1.2s linear, stops when done). Cards lift nothing on hover; they change bg to surface-subtle.

Reduced motion (`prefers-reduced-motion: reduce`): translate and scale removed; opacity fades at 100ms or less; celebrate becomes an instant colour change; progress bar replaced by static text updates. Required by project rule (RR §7).

## 9. Theme decision

Light theme only for the MVP [D]. A dark theme doubles contrast verification and visual tests with no evidence of user need for a planning tool. Tokens are named by role so a dark set can be added later.

## 10. Implementation guidance

- Primitives: React Aria Components for dialogs, menus, listbox, tabs, date input (APG-compliant behaviour) styled with tokens.
- One `tokens.css`, one `Button`, `Field`, `Money`, `StatusChip`, `DataTable`, `Dialog`, `Drawer`, `Toast` component each. Screens compose these only.
- Visual regression: Playwright screenshots of S-04, S-06, S-07, S-10 at 375px and 1280px (TESTING.md T-VIS).
