# Accessibility

Target: WCAG 2.2 Level AA for every screen, plus SC 2.3.3 (AAA) for motion as a project rule.
Related: [design/DESIGN_SYSTEM.md](design/DESIGN_SYSTEM.md), [UX_FLOWS.md](UX_FLOWS.md), [TESTING.md](TESTING.md) T-A11Y.

## 1. Keyboard

- Every action works with keyboard alone. Tab order follows visual order.
- Skip link "Skip to main content" is the first focusable element.
- Sidebar, bottom bar, tabs and segmented controls: arrow keys move within the group (roving tabindex), Tab leaves it.
- Menus and listboxes (event selector, row actions): APG behaviour via React Aria.
- Inline allocation edit: Enter to edit and to save, Esc to cancel.
- Reordering uses Move up and Move down buttons; no drag-only interaction (SC 2.5.7).

## 2. Focus

- Visible 2px ring in `--color-focus` with 2px offset on every focusable element (SC 2.4.7). Contrast 7.33:1 against the page.
- Sticky headers and the bottom bar must not hide the focused element (SC 2.4.11): `scroll-padding-top` and `scroll-padding-bottom` set to their heights.
- Route change: focus moves to the page `h1` (tabindex -1).
- Dialogs: focus moves to the first field, or to the least destructive button in confirmation dialogs; focus is trapped; Esc closes (except while saving); focus returns to the trigger.
- Delete in lists: focus moves to the next item or the list heading.

## 3. Forms

- Every input has a visible label. Required fields marked with text "(required)", not only an asterisk.
- Errors: message below the field linked with `aria-describedby`, `aria-invalid="true"`, plus an error summary at the top on submit with links to fields.
- Money fields announce the formatted value via helper text ("₹75,000").
- Authentication allows paste and password managers (SC 3.3.8).

## 4. Screen reader announcements

- `role="status"` live region (polite) for: saves, task completion with progress ("Task completed. 12 of 40 done."), AI progress stages, toasts.
- `role="alert"` only for submit errors and the offline banner appearing.
- Budget status changes after an edit are announced: "Catering is now over budget by ₹1,75,000."
- Icon-only buttons have `aria-label` with action and object.
- Status chips include text; icons are `aria-hidden`.
- Tables have `<caption>` and `<th scope>`.
- Compact money ("₹12.3 L") has the full value in `aria-label`.

## 5. Visual

- Contrast per DESIGN_SYSTEM.md §2.3: text 4.5:1 or more, UI boundaries 3:1 or more.
- Text resizes to 200% and reflows at 320px width without horizontal scrolling (SC 1.4.4, 1.4.10), except data tables, which reflow below 640px (§6).
- Text spacing overrides do not break layout (SC 1.4.12).
- No information by colour alone.

## 6. Responsive accessibility

| Width | Behaviour |
|---|---|
| Under 640px | Tables become stacked rows: each row is a list item with label and value pairs in DOM order; totals summary appears above the list |
| Under 768px | Bottom bar navigation; dialogs become bottom sheets; touch targets 44 by 44 px |
| 768 to 1023px | Icon rail with tooltips; labels available to assistive tech |
| 1024px and up | Full sidebar |

Minimum target size everywhere is 24 by 24 px (SC 2.5.8); the design uses 40 px or more.

## 7. Motion

Respect `prefers-reduced-motion` (DESIGN_SYSTEM.md §8). No content flashes. The only looping motion is the AI progress bar, which stops on completion and is replaced by text under reduced motion. No motion over 5 seconds without a stop control (SC 2.2.2): AI generation is capped at 45 s and its bar is not decorative content, but it still converts to static text under reduced motion.

## 8. Testing

Automated axe checks on every screen in Playwright, manual keyboard pass, and a screen reader pass with NVDA plus Firefox and VoiceOver plus Safari before release (TESTING.md §7).
