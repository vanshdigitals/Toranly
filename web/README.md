# Toranly web

React frontend for the Celebration & Event Planner (Toranly). Specification: [../celebration-event-planner-docs](../celebration-event-planner-docs/README.md).

Stack: Vite, React 19, TypeScript (strict), React Router, React Aria Components, lucide-react, Fontsource (Fraunces 600, Plus Jakarta Sans 400 to 700). Styling uses CSS custom properties from `src/styles/tokens.css` only.

## Run on Windows (PowerShell)

```powershell
cd C:\Users\vansh\Documents\Toranly\web
npm ci
npm run dev
```

Open http://localhost:5173.

## Scripts

| Script                            | Does                                         |
| --------------------------------- | -------------------------------------------- |
| `npm run dev`                     | Dev server with hot reload                   |
| `npm run build`                   | Type check, then production build to `dist/` |
| `npm run preview`                 | Serve the production build                   |
| `npm run lint`                    | ESLint                                       |
| `npm run typecheck`               | TypeScript project check (`tsc -b`)          |
| `npm run format` / `format:check` | Prettier                                     |

## Routes

`/` landing, `/login` and `/register` placeholders, anything else shows "Page not found".

## Theme

Light theme only (DESIGN_SYSTEM.md §9). The theme toggle is built but hidden behind `THEME_TOGGLE_ENABLED = false` in `src/components/ThemeToggle.tsx`. Dark values go in the `[data-theme="dark"]` block of `tokens.css` once approved.
