# Security

Project: Celebration & Event Planner (temporary name). This is a realistic baseline for a hackathon MVP, not a claim that the system is secure.
Related: [AI_SAFETY.md](AI_SAFETY.md), [API.md](API.md), [DATABASE.md](DATABASE.md).

> Phase 3 (guest-first, no accounts) is implemented as described in §10. Sections §1 and §2 on accounts, sessions and CSRF apply to the later optional sync phase.

## 1. Assets and threat model

| Asset | Threat | Control |
|---|---|---|
| Accounts | Credential stuffing, weak passwords | argon2id hashing; 10-char minimum; login rate limit 5 per 15 min per email and 20 per 15 min per IP; generic error messages |
| Event data | Access by another user (IDOR) | Owner-scoped repositories; 404 for others' ids; cross-tenant tests (TESTING.md T-SEC-01) |
| Vendor contacts, guest counts | Leakage via logs or AI | Redaction in logs; not in AI context (NFR-10) |
| xAI API key | Theft, cost abuse | Render env var only; never in frontend or repo; secret scanning in CI; per-user and global AI limits |
| Database URL | Theft | Env var only; TLS required (`sslmode=require`) |
| Sessions | Hijack, CSRF | HttpOnly, Secure, SameSite=Lax cookie; token stored hashed; CSRF header on all writes; Origin check |
| Availability | Request floods | Rate limits; 64 KB body limit; timeouts |

## 2. Authentication and sessions

- Register and login create a random 32-byte session token; only its SHA-256 hash is stored (`sessions`).
- Cookie `sid`: HttpOnly, Secure (except local dev), SameSite=Lax, Path=/, 14-day expiry.
- Logout deletes the session row. Account deletion deletes all sessions.
- CSRF: per-session random token returned by E-04 and E-06; client sends `X-CSRF-Token`. Server also checks `Origin` equals the app origin on state-changing requests.
- No MFA and no password reset by email in MVP [D, residual risk]. Users who forget their password cannot recover the account; this is stated on the register screen.

## 3. Input validation and injection

- Pydantic with `extra="forbid"`, length and range limits on every field (API.md, DATABASE.md).
- SQL: SQLAlchemy Core/ORM with bound parameters only; raw SQL strings are blocked in review and by a Ruff rule where possible.
- XSS: React escapes text; `dangerouslySetInnerHTML` forbidden by ESLint rule; CSP header:
  `default-src 'self'; img-src 'self' data:; style-src 'self'; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`.
- Other headers: `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`, `Strict-Transport-Security` in production.
- Client-side data boundary: In Guest-First mode (Option C), all user plans reside strictly on the user's local device in IndexedDB. No user data is sent across the network by default.
- CSV formula injection escaping: both server-side and client-side exporters escape cells starting with `=`, `+`, `-`, or `@` by prefixing a single quote `'`.
- Backup file sanitization: `.toranly.json` files are capped at 2MB and verified via Zod schemas before parsing.
- AI privacy boundary (NFR-10): `preferences.notes`, guest personal names, email addresses, and phone numbers are strictly excluded from AI request contexts.

## 4. CORS

Production is same-origin; CORS middleware is disabled when `CORS_ORIGINS` is empty. Development allows only the Vite origin with credentials.

## 5. Privacy

- Personal data held: email, vendor names and contacts, notes. No payment data.
- AI receives only `PlanContext` (AI_SCHEMAS.md §2). xAI stores Responses for 30 days [V]; opt-out unverified [U].
- Logs: JSON lines with request id, route, status, latency, user id. Request bodies are never logged.
- Users can delete events and their account; deletion cascades (DATABASE.md §7). Nightly dumps expire after 7 days.

## 6. Errors

Problem Details only. 500 responses never include exception text. A request id is returned in `X-Request-Id` for support.

## 7. Dependencies and supply chain

`pip-audit` and `npm audit --audit-level=high` in CI; Dependabot weekly; lock files committed; GitHub secret scanning enabled; `gitleaks` in CI.

## 8. Deployment hardening

- `APP_ENV=production` disables docs UI (`/docs`) and debug.
- Container runs as a non-root user.
- Database role has only the privileges needed by the app; migrations run with the same role in MVP [residual risk].

## 9. Known residual risks

1. No MFA or account recovery.
2. Single region, short restore window, nightly dumps only.
3. In-memory general rate limiter resets on restart.
4. AI output filters may miss novel patterns; users can still reject items.
5. Provider data retention not verified.
6. Free hosting has no SLA and may restart at any time.

## 10. Guest-first backend controls (Phase 3, implemented)

| Control | Implementation |
|---|---|
| Secrets | Environment only (`backend/.env` git-ignored, or host secrets); both `XAI_API_KEY` and `GROQ_API_KEY` are registered with the log redactor, and `your_..._here` placeholders count as unset. Never logged, returned or bundled. Tests send a sentinel key through every endpoint and failure path and scan `web/dist`; CI greps `web/` for `api.x.ai`, `XAI_` and key patterns |
| Device identity | `GET /api/v1/ai/status` sets `tdv` = base64url(32 random bytes) + "." + HMAC-SHA256(SESSION_SECRET, id). HttpOnly, SameSite=Lax, Path=/api, 180 days, Secure in production. Only SHA-256(id) is stored. Tampered or malformed cookies are rejected (401 on `/ai/suggest`; `/ai/status` issues a new one) |
| IP handling | Stored only as HMAC-SHA256(IP_HASH_SALT, ip). `X-Forwarded-For` is used only when the direct peer is in `TRUSTED_PROXY_CIDRS`, reading from the right and skipping trusted hops, so clients cannot spoof it. Uvicorn runs with `--no-proxy-headers` |
| Origin check | Every POST/PUT/PATCH/DELETE needs `Origin` equal to `APP_ORIGIN` (or the Host-derived origin), plus `CORS_ORIGINS` in development only. Otherwise 403 `origin_not_allowed`. With SameSite=Lax cookies this replaces a CSRF token while there are no accounts |
| CORS | Exact-origin allowlist with credentials, development only; disabled in production (same origin); `*` refused at startup in production |
| Request limits | 413 above `MAX_BODY_BYTES` (Content-Length and streamed bodies); Pydantic `extra="forbid"` and bounds on every field; 60 requests/min per IP for plan and status endpoints |
| Headers | CSP as in §3, `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`, `X-Frame-Options: DENY`, `Cache-Control: no-store` on `/api`, HSTS in production, `X-Request-Id` on every response (including 403/413/500) |
| Errors and logs | Problem Details only; 500s carry no exception text. JSON logs include an allowlist of fields; exceptions log only type and frame locations (no message, no source text); a redaction pass masks registered secrets, `xai-` keys, bearer tokens, cookies and DB URLs. Bodies, prompts, cookies and IPs are never logged |
| Production | `/docs`, `/redoc`, `/openapi.json` return 404; startup fails if `SESSION_SECRET`/`IP_HASH_SALT` are under 32 bytes; container runs as uid 10001 |
| Dependencies | Exact pins with hashes (`requirements.txt` from `uv.lock`); `pip-audit` in CI (clean on 2026-10-28) |
| AI | AI_SAFETY.md §4 and §9: `<user_data>` delimiting, no tools, strict schema, Pydantic, guards, `store=false`, no prompt storage |

### Residual risks (Phase 3)

1. A user can clear cookies to get a new device id; the IP and global layers still cap usage, but users behind one NAT share the IP budget.
2. The provider guard, circuit breaker and general API limiter are per process and reset on restart.
3. The plan reference endpoints accept full plans, which may contain vendor names and contacts. They are not stored or logged, but they do cross the network; the web app does not call them today.
4. `TRUSTED_PROXY_CIDRS` for Render is an assumption to verify; when wrong, all users share the proxy's IP bucket (fails closed, not open).
5. The CSP `style-src 'self'` has not been checked against every third-party UI component at runtime in production.
6. Output filters can miss novel phone or URL formats, and they can over-strip number ranges that look like phone numbers.
7. xAI's retention when `store=false` is set is not independently verified.
