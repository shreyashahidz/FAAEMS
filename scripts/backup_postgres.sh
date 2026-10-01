#!/usr/bin/env bash
# Phase 13.1: daily full Postgres backup, encrypted at rest.
#
# Run on the college server via cron, e.g.:
#   0 2 * * * /opt/faems/scripts/backup_postgres.sh >> /var/log/faems/backup.log 2>&1
#
# Requires: BACKUP_ENCRYPTION_KEY in the environment (a long random
# passphrase — do NOT reuse DJANGO_SECRET_KEY). Retention is configurable,
# not hardcoded (Phase 13.7).
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
set -a; source .env; set +a

: "${BACKUP_ENCRYPTION_KEY:?Set BACKUP_ENCRYPTION_KEY before running backups.}"
BACKUP_DIR="${BACKUP_DIR:-./backups/postgres}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"

mkdir -p "$BACKUP_DIR"
OUT_FILE="$BACKUP_DIR/faems_${TIMESTAMP}.sql.gz.enc"

echo "[backup_postgres] Dumping database '$POSTGRES_DB'..."
docker compose exec -T db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=plain \
  | gzip \
  | openssl enc -aes-256-cbc -pbkdf2 -salt -pass "pass:${BACKUP_ENCRYPTION_KEY}" -out "$OUT_FILE"

echo "[backup_postgres] Wrote $OUT_FILE ($(du -h "$OUT_FILE" | cut -f1))"

echo "[backup_postgres] Pruning backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -name 'faems_*.sql.gz.enc' -mtime "+${RETENTION_DAYS}" -print -delete

echo "[backup_postgres] Done."
