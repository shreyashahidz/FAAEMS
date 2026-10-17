## Faculty Contribution

Built for Thakur College of Engineering using Django + DRF backend, React + Vite + Tailwind frontend, PostgreSQL, MinIO, all in Docker Compose.

## Quick start

```bash
cp .env.example .env   # or use the .env already in this repo for local dev
docker compose up -d
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py seed_demo
```

Open **http://localhost:5173**. Backend API is on **http://localhost:8010** (8000 was already in use by another local project).

Login is restricted to `@tcetmumbai.in` addresses, enforced server-side.

## Key Features

- **Authentication & RBAC:** Institutional email verification and role-based access control (Faculty, HOD, IQAC Admin).
- **Evidence Management:** Upload and track faculty achievements with document validation, SHA-256 hashing, and MinIO object storage.
- **OCR & Document Extraction:** Multi-format text extraction (PDF, images, Office documents) with local LLM-assisted analysis.
- **NBA Criteria Mapping:** Full mapping against NBA Criterion 6, with automated score calculations and gap tracking.
- **Report Generation & Analytics:** One-click monthly and annual report generation, analytics dashboard, and full-text search.
- **Data Integrity & Backups:** Scheduled integrity verification, audit logging, and automated encrypted backup/restore tooling.

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


