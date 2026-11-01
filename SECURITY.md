# Security

## Reporting a problem

Please report security issues privately through GitHub's **Report a vulnerability** (Security
tab of this repository) instead of a public issue. Include steps to reproduce. We aim to reply
within 7 days.

## How Toranly protects users

**Data stays on the device.** Plans are stored in the browser (IndexedDB). The backend is
stateless; Postgres only holds AI usage counters with a hashed device id and a salted IP hash.

**Secrets.** Provider keys (xAI, Groq) exist only in the backend environment. `backend/.env` is
git-ignored, `.env.example` has placeholders only, and CI fails if a key or provider URL appears
in `web/` or the build. Logs redact secrets (tested).

**Input validation.** Every endpoint uses Pydantic models with `extra="forbid"`, length limits
on every string and list, and range limits on numbers. Request bodies over 64 KB are refused
(413, also for chunked bodies).

**Abuse limits.** Per-IP API limit; AI limits per device per minute and per day, per IP per day,
a global daily limit and a daily spend cap, enforced atomically in Postgres.

**Browser protections.** Same-origin app and API. POST requests need an allowed `Origin`
(403 otherwise). A signed, HttpOnly, SameSite=Lax device cookie (Secure in production).
Headers on every response: CSP (`default-src 'self'`, `frame-ancestors 'none'`), HSTS in
production, `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`,
`X-Frame-Options: DENY`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`.

**Errors.** One RFC 9457 Problem Details handler; no stack traces or input echoed back.
`/docs` and `/openapi.json` are off in production. The Docker image runs as a non-root user.

**AI safety.** Only an event summary is sent (type, month, city, guest range, budget,
preferences); notes, names, contacts and exact dates never are, enforced by tests on both
sides. User text is treated as data, never instructions; AI output is schema-validated and
filtered (links, emails and phone numbers removed, booking claims dropped). Nothing reaches
the plan until the user accepts it.

**Frontend.** No `dangerouslySetInnerHTML`, `eval` or `new Function`. Backup import is limited
to 2 MB, checked with Zod and then with `POST /plan/validate`. CSV export escapes formula
characters.

**Dependencies.** `pip-audit` and `npm audit --omit=dev` report no known vulnerabilities
(checked 2026-11-01).
