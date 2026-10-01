# FAEMS Deployment — Phase 14 (On-Prem College Server)

This is the checklist for taking the stack from this dev environment to the college's own server. Nothing here has been run against a real college server (none is available in this environment) — everything below has been verified against the local Docker Compose stack, which uses the identical `docker-compose.yml`.

## 1. What's already deployment-shaped

- **Named volumes, not anonymous:** `postgres_data`, `minio_data`, `backend_logs`, `frontend_node_modules` — confirmed to survive `docker compose restart` (tested live, several times, across this session, including a Docker Desktop crash mid-session — no data was lost).
- **`db` and `minio` are not published to the host.** `docker-compose.yml` uses `expose: ["5432"]` for `db` (no `ports:` mapping) — only reachable by other containers on `faems_default`. `minio`'s S3 API port (9000) is likewise internal-only; only its admin console (9001) is bound to `127.0.0.1` for local dev convenience, and that mapping is commented as **remove before production**.
- **Evidence/report files never leave via a direct MinIO URL** — every download goes through an authenticated Django proxy endpoint (see `SECURITY_AUDIT.md` §12.4), so even if `minio` were reachable, presigned URLs are never handed to the browser.
- **CORS, security headers, rate limiting, structured logging** — all already active (see `SECURITY_AUDIT.md`).

## 2. Before deploying — questions for the college's IT department

1. Does the server have a static internal IP or hostname faculty/HOD will use to reach the app?
2. Is HTTPS available/required on the college network? (If yes: terminate TLS at an `nginx` reverse-proxy container in front of `frontend`/`backend`, added to `docker-compose.yml` — not yet added, since there's no real domain/cert to configure against in this environment.)
3. What firewall rules are needed to reach the server from faculty laptops/department systems?
4. Who else has physical/SSH access to the server? (That access bypasses the app's own RBAC — worth documenting explicitly for the institution's own records.)

## 3. Deployment steps

```bash
# On the college server, as a non-root user with Docker installed:
git clone <repo> /opt/faems && cd /opt/faems
cp .env.example .env
# Edit .env: real DJANGO_SECRET_KEY, real DB/MinIO passwords, real
# BACKUP_ENCRYPTION_KEY, ALLOWED_EMAIL_DOMAIN, DJANGO_DEBUG=false,
# DJANGO_ALLOWED_HOSTS=<real hostname>, CORS_ALLOWED_ORIGINS=<real frontend origin>,
# POSTGRES_SSLMODE=require (once TLS is configured on the DB).

docker compose up -d --build
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py createsuperuser   # or run seed_demo for a first admin, then change the password
```

Then, **before considering this live**:

```bash
# Confirm a container restart doesn't lose data (Phase 14.3):
docker compose restart db
docker compose exec backend python manage.py shell -c "from apps.accounts.models import User; print(User.objects.count())"

# Confirm db/minio ports are NOT reachable from outside:
# (run from a machine other than the server itself)
nc -zv <server-ip> 5432   # should fail/timeout
nc -zv <server-ip> 9000   # should fail/timeout

# Re-run the attacker's-perspective checks from SECURITY_AUDIT.md §12.5
# against the deployed staging environment — deployment config changes
# (CORS, env vars, exposed ports) can reintroduce issues that passed locally.

# Run the actual backup + restore drill against the real deployed volumes:
bash scripts/backup_postgres.sh
bash scripts/backup_minio.sh
bash scripts/restore_drill.sh
```

## 4. Scheduled jobs to cron on the server

```cron
# Daily backups, 2am
0 2 * * * cd /opt/faems && bash scripts/backup_postgres.sh >> /var/log/faems/backup.log 2>&1
0 2 * * * cd /opt/faems && bash scripts/backup_minio.sh    >> /var/log/faems/backup.log 2>&1

# Weekly restore drill — catches "the backup script silently broke" before
# it matters (this exact failure mode happened once already in dev, see
# SECURITY_AUDIT.md — a Windows path-mangling bug produced a valid-looking
# but empty MinIO backup that only the restore drill caught)
0 3 * * 0 cd /opt/faems && bash scripts/restore_drill.sh >> /var/log/faems/restore_drill.log 2>&1

# Daily notification scan (Phase 9)
0 6 * * * cd /opt/faems && docker compose exec -T backend python manage.py generate_notifications >> /var/log/faems/notifications.log 2>&1

# Daily evidence integrity check (Phase 13.6)
0 4 * * * cd /opt/faems && docker compose exec -T backend python manage.py verify_evidence_integrity >> /var/log/faems/integrity.log 2>&1
```

## 5. Staging environment

Run a second copy of the stack on the same server on different ports for final testing before go-live:

```bash
docker compose -p faems-staging -f docker-compose.yml --env-file .env.staging up -d
```

(`.env.staging` should use different `POSTGRES_PORT`-mapped-nowhere, different container name prefix via `-p`, and its own `BACKUP_ENCRYPTION_KEY` — never share encryption keys between staging and production backups.)

## 6. Retention policy (configurable, per Phase 13.7 — not hardcoded)

Set in `.env`:

- `BACKUP_RETENTION_DAYS` — how many days of Postgres/MinIO backup generations to keep (default 30 in this repo; institutional policy should set the real number).
- Soft-deleted record purge and report-snapshot cold-archival are **not yet automated** — the playbook is explicit that this should be "configurable according to institutional retention policy" rather than an arbitrary fixed number, and that policy needs to come from the institution, not be invented here. Until that's defined, soft-deleted rows and report snapshots are kept indefinitely (safe default — nothing is ever purged automatically).

## 7. Known gaps for a real deployment (see also SECURITY_AUDIT.md)

- No TLS termination configured yet (no real domain/cert available in this dev environment) — add an `nginx` service to `docker-compose.yml` once the college's HTTPS answer (§2.2) is known.
- `POSTGRES_SSLMODE` is `disable` in dev — switch to `require`/`verify-full` once Postgres is configured with certs.
- Rotate every credential in `.env` before go-live — the values in this repo's `.env` are dev-only placeholders that have been in active use throughout this build/test session.
