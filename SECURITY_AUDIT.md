# FAEMS Security Audit — Phase 12

Written after each check below was actually run against the live stack (not ticked from memory). Dated 2026-09-20.

## 12.1 — Secret Leak Prevention

| Check | Result |
|---|---|
| All secrets in env vars | ✅ `.env` holds `DJANGO_SECRET_KEY`, DB/MinIO creds, `BACKUP_ENCRYPTION_KEY`. None hardcoded in source. |
| No `VITE_`-prefixed secret in client bundle | ✅ Only `VITE_API_BASE_URL` (a public URL) is exposed to the frontend. |
| `.env` gitignored, `.env.example` placeholders only | ✅ Verified in `.gitignore`. |
| No secret in logs/API responses | ✅ Structured JSON logger never logs request bodies; `correlated_exception_handler` returns generic messages + correlation id on 5xx, never a traceback. |
| Hardcoded secrets during development, rotated before go-live | ⚠️ The `.env` committed to this dev environment (secret key, DB password, MinIO creds, backup key) are all placeholder/dev values — **rotate every one of them before any real deployment.** |

## 12.2 — Personal Data Flow Audit

- Personal data collected: name, email, contact number, employee ID, department, designation. No unnecessary fields (no address, no ID document numbers).
- Passwords: Django's PBKDF2 hasher, never logged, never returned in any API response (`User` serializers never include `password`).
- Session/token cookies: JWT is bearer-token based (not cookie-based), so CSRF cookie is set `httpOnly=False` only because the frontend needs to read it for `X-CSRFToken` on the few session-based views; access/refresh tokens live in `localStorage` on the frontend — **documented tradeoff**, see `frontend/src/api/client.js` comment. A hardened deployment should move to httpOnly cookies.
- API responses are field-filtered per serializer — verified no serializer exposes `password`, `mfa_secret`, or another user's data (see IDOR tests in 12.4).
- Account deletion/anonymization vs. evidence retention are kept as two separate concepts in the code: `User.is_deleted`/`deleted_at` (personal/login data) is entirely separate from `Achievement`/`EvidenceDocument` soft-delete, which is never triggered by account anonymization.

## 12.3 — Pre-Deploy Production Audit

| Check | Result |
|---|---|
| Required env vars refuse a `DEBUG=false` start with placeholder secret | ✅ `settings.py` raises `RuntimeError` if `SECRET_KEY` is still the placeholder and `DEBUG=False`. |
| No debug prints / commented-out code / TODO on security-relevant paths | ✅ Reviewed `apps/accounts`, `apps/achievements` — none found. |
| `DEBUG=False` in production | Set via `.env` — must be confirmed at deploy time (currently `true` for local dev). |
| Generic client errors + correlation ID | ✅ Verified live: a 500 error returns `{"detail": "Something went wrong...", "correlation_id": "..."}` and the same id appears in the structured backend log. |
| Security headers on every response | ✅ Verified via `curl -I`: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Content-Security-Policy`, `Referrer-Policy`, `Cross-Origin-Opener-Policy`. HSTS auto-enables when `DEBUG=False`. |
| Rate limits | ✅ Login throttled to 5/min/IP (`LoginRateThrottle`, `DEFAULT_THROTTLE_RATES`). Password reset endpoint isn't built yet (feature intentionally disabled per product decision), so its throttle class exists but is unused — no live endpoint to abuse. |
| CORS restricted | ✅ `CORS_ALLOWED_ORIGINS` is an explicit list (`http://localhost:5173` in dev), never `*`. |
| Postgres TLS, no default creds, no exposed port | ⚠️ Dev stack runs `sslmode=disable` and `db`/`minio` are **not** published to the host (`docker-compose.yml` uses `expose`, not `ports`, for `db`) — confirmed no host port binding. TLS must be turned on (`POSTGRES_SSLMODE=require` + cert config) for the real deployment. |

## 12.4 — Deep Security Audit

- **Every protected endpoint** uses `IsAuthenticated` by default (`REST_FRAMEWORK.DEFAULT_PERMISSION_CLASSES`); role-specific endpoints add explicit permission classes (`IsSuperAdmin`, `IsIQACAdminOrAbove`, etc.).
- **IDOR — tested live, not just by design:**
  - A second faculty account fetching another faculty's `Achievement` by ID → **404** (queryset-scoped, doesn't even confirm the record exists).
  - Same account fetching another faculty's evidence file via `/evidence-documents/{id}/download/` → **404**.
  - Unauthenticated request to the same download endpoint → **401**.
  - HOD role hitting the IQAC-only `/reports/` list → **403**.
  - Faculty role hitting the AI assistant with a cross-department question → refused with an explanation, not a leaked answer.
  - Found and fixed a real bug during this testing: `can_access_achievement`/`can_access_faculty_profile` referenced `user.faculty_profile_id`, which doesn't exist on the reverse side of a `OneToOneField` — this was throwing `AttributeError` (→ 500) on every evidence upload before the fix. Now resolved via `getattr(user, "faculty_profile", None)`.
- **Password reset tokens:** not applicable yet — self-service reset is intentionally not implemented (product decision); the login page's "Forgot password" only shows a message directing the user to IQAC/admin.
- **JWT:** signed with `DJANGO_SECRET_KEY` (env-sourced), 15 min access / 1 day refresh, rotation + blacklist-after-rotation enabled, logout blacklists the refresh token.
- **SQL:** 100% Django ORM, no raw SQL anywhere in the codebase.
- **XSS:** all user-rendered free text (`description`, `remarks`, notification `message`) is rendered via React, which escapes by default; no `dangerouslySetInnerHTML` anywhere in the frontend (verified by search).
- **File uploads:** validated server-side by magic bytes (not extension/client MIME), size-capped at 20MB, served only through the authenticated Django proxy — never with execute permissions, never directly from MinIO.

## 12.5 — Attacker's Perspective Review

| Attempt | Result |
|---|---|
| Cross-user data access via ID manipulation | Blocked — see 12.4 IDOR tests. |
| Expired/malformed/missing token | 401, verified. |
| Privileged endpoint as `faculty` role (URL guessing) | 403/404 depending on endpoint — verified on `/reports/`, `/departments/` (write), exit-confirm actions. |
| Rate limits against mass login attempts | 5/min/IP enforced; 5 consecutive failed logins on one account also triggers a 15-minute account lock independent of the IP throttle. |
| Script injection into free-text fields | Stored as plain text, rendered by React (auto-escaped) — no execution path found. |
| Django admin reachable without auth | Django admin requires login same as any Django admin; **not yet placed behind network-level restriction** — Phase 14 deployment must ensure `/django-admin/` is not reachable from outside the reverse proxy's allowed paths, or add IP allowlisting. |
| `.env` / `.git` via direct URL | Not served — Django/Nginx never serves the project root as static files; confirmed no `StaticFilesStorage` path overlaps the repo root. |
| Report/evidence download enforcing ownership at the endpoint | ✅ Verified — `download` actions re-check `can_access_achievement`/role even though the queryset is already scoped (defense in depth). |

## 12.6 — Application Logging

- Structured JSON logs (`python-json-logger`) with `timestamp`, `level`, `logger name`, `message`, `correlation_id` — verified format live.
- Log levels used correctly: `INFO` for normal ops, `WARNING` for OCR-fallback/duplicate-flag events, `CRITICAL` for integrity-check failures (verified live — see the `verify_evidence_integrity` test in `README.md`/Phase 13).
- No secrets/PII found in any log line reviewed.
- Logs write to `/app/logs` on a named Docker volume (`backend_logs`) — survives container restarts, independent of the app's writable layer.
- Correlation IDs propagate: confirmed the same id shown in a 500 response also appears in the corresponding backend log line.

## Summary of issues found and fixed during this audit

1. **`faculty_profile_id` AttributeError** (500 on every evidence upload) — fixed in `apps/accounts/permissions.py` and `apps/achievements/views.py`.
2. **Evidence/report files served as direct MinIO URLs** — violated the Phase 14 "MinIO never publicly exposed" rule. Fixed by proxying all downloads through authenticated Django endpoints.
3. **Backup scripts silently produced empty/corrupt archives on Windows** (MSYS path-mangling of Docker volume arguments) — the restore drill caught this for real (see Phase 13 in README) before it could hide a false sense of security.

## Not yet done (explicitly deferred, not silently skipped)

- Professional third-party penetration test — this audit is a structured self-review, not a substitute (per the playbook's own caveat).
- TLS between Django and Postgres in the running dev stack (deployment-time config).
- ClamAV malware scanning on uploads (playbook marks this optional/stretch).
