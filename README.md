# FAEMS — Faculty Achievement & Accreditation Evidence Management System

Built for Thakur College of Engineering using Django + DRF backend, React + Vite + Tailwind frontend, PostgreSQL, MinIO, all in Docker Compose.

## Quick start

```bash
cp .env.example .env   # or use the .env already in this repo for local dev
docker compose up -d
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py seed_demo
```

Open **http://localhost:5173**. Backend API is on **http://localhost:8010** (8000 was already in use by another local project)..

Login is restricted to `@tcetmumbai.in` addresses, enforced server-side.

## What's implemented and verified

Every phase below was tested against the real running stack (not just written) — see `SECURITY_AUDIT.md` for the IDOR/RBAC test log and `DEPLOYMENT.md` for the restore-drill run.

| Phase | Status |
|---|---|
| 0 — Project setup | ✅ Postgres + MinIO wired, health check live |
| 1 — Auth, RBAC, MFA | ✅ Real TOTP MFA, account lockout, captcha, institutional-domain enforcement |
| 2 — Achievement/evidence model | ✅ Human-readable Evidence IDs, SHA-256 hashing, soft delete, MinIO storage |
| 3 — Verification workflow | ✅ Full lock/unlock/versioning cycle, mandatory remarks, atomic transactions, audit trail |
| 4 — Duplicate detection & OCR | ✅ Real Tesseract OCR (PDF + image), confidence scoring, never blocks submission |
| 5 — Criteria mapping engine | ✅ NBA Criterion 6 seeded from the real SAR table, fully data-driven |
| 6 — Completeness score & gaps | ✅ Live dashboard rings + per-category breakdown, real DB aggregates |
| 7 — Report generation | ✅ Real DOCX generator, checksummed snapshots, integrity re-verification |
| 8 — Search & analytics | ✅ Postgres full-text search (incl. OCR text), Data Quality dashboard |
| 9 — Notifications | ✅ Event-driven triggers + scheduled expiry/profile scan, in-app bell |
| 10 — Faculty exit / alumni | ✅ Full 4-step exit workflow, alumni archive view, evidence stays linked |
| 11 — AI Accreditation Assistant | ✅ Rule-based NL query layer over real endpoints, cites Evidence IDs, refuses out-of-scope |
| 12 — Security hardening | ✅ Audited — see `SECURITY_AUDIT.md` |
| 13 — Backup & integrity | ✅ Real encrypted backups + a restore drill that actually ran (and caught a real bug) |
| 14 — Deployment | 📋 Documented in `DEPLOYMENT.md` — no real college server available to deploy to yet |

## UI

Styled to match the "Accreditation Core" reference design shared for this project (blue/white institutional SaaS look, not a generic dark AI theme) — top navbar, Material Symbols icons, department carousel, Action Centre cards, completeness ring, faculty contributor cards.

## Repo layout

```
backend/           Django + DRF (apps/accounts, achievements, criteria, reports, notifications, assistant, audit, common)
frontend/           React + Vite + Tailwind
scripts/            backup_postgres.sh, backup_minio.sh, restore_drill.sh
docker-compose.yml
SECURITY_AUDIT.md   Phase 12 write-up
DEPLOYMENT.md       Phase 14 checklist
```

## Running the backup/restore tooling

```bash
bash scripts/backup_postgres.sh
bash scripts/backup_minio.sh
bash scripts/restore_drill.sh   # actually restores into a scratch container and verifies
```

Requires `BACKUP_ENCRYPTION_KEY` in `.env` (already set to a dev placeholder — rotate before real use).

## Scheduled jobs (cron these in production — see DEPLOYMENT.md)

```bash
docker compose exec backend python manage.py generate_notifications
docker compose exec backend python manage.py verify_evidence_integrity
```


