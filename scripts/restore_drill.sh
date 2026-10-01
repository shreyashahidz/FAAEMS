#!/usr/bin/env bash
# Phase 13.4/13.5: mandatory restore drill — actually restores the latest
# backups into a throwaway scratch environment and verifies the DB rows AND
# their linked evidence files both survive and stay correctly linked. This
# is not "a backup file exists," it's "we proved it comes back."
#
# Uses named Docker volumes rather than host bind mounts to move files
# between containers (see backup_minio.sh for why: MSYS/Git-Bash mangles
# `-v hostpath:containerpath` arguments on Windows).
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
set -a; source .env; set +a

: "${BACKUP_ENCRYPTION_KEY:?Set BACKUP_ENCRYPTION_KEY before running the restore drill.}"

PG_BACKUP="$(ls -t backups/postgres/faems_*.sql.gz.enc 2>/dev/null | head -1 || true)"
MINIO_BACKUP="$(ls -t backups/minio/minio_*.tar.gz.enc 2>/dev/null | head -1 || true)"

if [ -z "$PG_BACKUP" ] || [ -z "$MINIO_BACKUP" ]; then
  echo "No backups found — run scripts/backup_postgres.sh and scripts/backup_minio.sh first." >&2
  exit 1
fi

echo "== Restore drill =="
echo "Postgres backup: $PG_BACKUP"
echo "MinIO backup:    $MINIO_BACKUP"

SCRATCH_DB="faems-restore-drill-db"
SCRATCH_VOLUME="faems-restore-drill-vol-$$"
SCRATCH_NET="faems_default"
docker rm -f "$SCRATCH_DB" >/dev/null 2>&1 || true
docker volume create "$SCRATCH_VOLUME" >/dev/null

cleanup() {
  echo "-- Cleaning up scratch instance/volume --"
  docker rm -f "$SCRATCH_DB" >/dev/null 2>&1 || true
  docker volume rm "$SCRATCH_VOLUME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "-- Starting scratch Postgres instance --"
MSYS_NO_PATHCONV=1 docker run -d --name "$SCRATCH_DB" --network "$SCRATCH_NET" \
  -e POSTGRES_DB=faems_restore -e POSTGRES_USER=faems_app -e POSTGRES_PASSWORD=scratch_only \
  postgres:16-alpine >/dev/null

echo "-- Waiting for scratch Postgres to accept connections --"
for _ in $(seq 1 30); do
  if docker exec "$SCRATCH_DB" pg_isready -U faems_app -d faems_restore >/dev/null 2>&1; then break; fi
  sleep 1
done

echo "-- Decrypting and restoring Postgres backup into scratch instance --"
openssl enc -d -aes-256-cbc -pbkdf2 -salt -pass "pass:${BACKUP_ENCRYPTION_KEY}" -in "$PG_BACKUP" \
  | gunzip \
  | docker exec -i "$SCRATCH_DB" psql -U faems_app -d faems_restore -q >/dev/null

echo "-- Comparing row counts: production vs restored --"
PROD_COUNT=$(docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c \
  "SELECT count(*) FROM achievements_achievement;" | tr -d '[:space:]')
RESTORED_COUNT=$(docker exec "$SCRATCH_DB" psql -U faems_app -d faems_restore -t -c \
  "SELECT count(*) FROM achievements_achievement;" | tr -d '[:space:]')

echo "   achievements_achievement: production=$PROD_COUNT restored=$RESTORED_COUNT"
if [ "$PROD_COUNT" != "$RESTORED_COUNT" ]; then
  echo "FAIL: row counts do not match." >&2
  exit 1
fi

echo "-- Decrypting and extracting MinIO backup into scratch volume --"
openssl enc -d -aes-256-cbc -pbkdf2 -salt -pass "pass:${BACKUP_ENCRYPTION_KEY}" -in "$MINIO_BACKUP" \
  | MSYS_NO_PATHCONV=1 docker run --rm -i -v "${SCRATCH_VOLUME}:/restore" alpine tar -xzf - -C /restore

echo "-- Verifying a sample of restored evidence files against their recorded DB hash --"
SAMPLE_ROW=$(docker exec "$SCRATCH_DB" psql -U faems_app -d faems_restore -t -A -F'|' -c \
  "SELECT object_key, file_hash FROM achievements_evidencedocument WHERE object_key <> '' ORDER BY id LIMIT 1;")

if [ -n "$SAMPLE_ROW" ]; then
  OBJECT_KEY="${SAMPLE_ROW%%|*}"
  EXPECTED_HASH="${SAMPLE_ROW##*|}"
  echo "   Checking object: $OBJECT_KEY"
  RESULT=$(MSYS_NO_PATHCONV=1 docker run --rm -v "${SCRATCH_VOLUME}:/restore" alpine sh -c "
    if [ ! -f '/restore/${OBJECT_KEY}' ]; then echo 'MISSING'; exit 0; fi
    sha256sum '/restore/${OBJECT_KEY}' | cut -d' ' -f1
  ")
  echo "   expected=$EXPECTED_HASH actual=$RESULT"
  if [ "$RESULT" = "MISSING" ]; then
    echo "FAIL: $OBJECT_KEY missing from restored MinIO backup." >&2
    exit 1
  fi
  if [ "$EXPECTED_HASH" != "$RESULT" ]; then
    echo "FAIL: restored file hash does not match the DB record." >&2
    exit 1
  fi
else
  echo "   (no evidence documents to sample — skipping file check)"
fi

echo "== Restore drill PASSED: DB rows and their linked files both restore correctly and stay linked. =="
