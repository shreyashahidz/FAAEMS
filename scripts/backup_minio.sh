#!/usr/bin/env bash
# Phase 13.2/13.3: MinIO evidence backup, encrypted at rest, with object
# versioning enabled on the bucket so an overwrite/delete is itself
# recoverable independent of this backup.
#
# Uses a scratch named Docker volume (not a host bind mount) to move files
# between containers — on Windows/Git Bash, MSYS silently mangles
# `-v hostpath:containerpath` arguments (it "helpfully" rewrites container
# paths as if they were Windows paths), so bind mounts are unreliable here.
# A named volume has no slashes, so MSYS's path auto-conversion never
# touches it.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
set -a; source .env; set +a

: "${BACKUP_ENCRYPTION_KEY:?Set BACKUP_ENCRYPTION_KEY before running backups.}"
BACKUP_DIR="${BACKUP_DIR:-./backups/minio}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
SCRATCH_VOLUME="faems-backup-scratch-$$"

mkdir -p "$BACKUP_DIR"
docker volume create "$SCRATCH_VOLUME" >/dev/null
trap 'docker volume rm "$SCRATCH_VOLUME" >/dev/null 2>&1 || true' EXIT

echo "[backup_minio] Enabling versioning on bucket (idempotent)..."
MSYS_NO_PATHCONV=1 docker run --rm --network faems_default --entrypoint sh quay.io/minio/minio:latest -c "
  mc alias set local http://minio:9000 '${MINIO_ROOT_USER}' '${MINIO_ROOT_PASSWORD}' >/dev/null &&
  mc version enable local/${MINIO_BUCKET_NAME}
"

echo "[backup_minio] Mirroring bucket '${MINIO_BUCKET_NAME}' into scratch volume..."
MSYS_NO_PATHCONV=1 docker run --rm --network faems_default -v "${SCRATCH_VOLUME}:/backup" --entrypoint sh quay.io/minio/minio:latest -c "
  mc alias set local http://minio:9000 '${MINIO_ROOT_USER}' '${MINIO_ROOT_PASSWORD}' >/dev/null &&
  mc mirror --quiet local/${MINIO_BUCKET_NAME} /backup
"

OUT_FILE="$BACKUP_DIR/minio_${TIMESTAMP}.tar.gz.enc"
echo "[backup_minio] Streaming scratch volume contents through tar + encryption to host..."
MSYS_NO_PATHCONV=1 docker run --rm -v "${SCRATCH_VOLUME}:/backup" alpine tar -C /backup -czf - . \
  | openssl enc -aes-256-cbc -pbkdf2 -salt -pass "pass:${BACKUP_ENCRYPTION_KEY}" -out "$OUT_FILE"

echo "[backup_minio] Wrote $OUT_FILE ($(du -h "$OUT_FILE" | cut -f1))"

echo "[backup_minio] Pruning backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -name 'minio_*.tar.gz.enc' -mtime "+${RETENTION_DAYS}" -print -delete

echo "[backup_minio] Done."
