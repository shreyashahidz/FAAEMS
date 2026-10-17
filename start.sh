#!/usr/bin/env bash
# One command to start FAEMS (frontend + backend + database + file storage).
#
#   ./start.sh            start everything (rebuilds only what changed)
#   ./start.sh --rebuild  force a full rebuild of the images
#   ./start.sh --stop     stop everything (data is kept)
#
# Run it from Git Bash (Windows) or any bash shell, from the project folder.

set -u
cd "$(dirname "$0")"

FRONTEND_URL="http://localhost:5173"
BACKEND_CHECK="http://localhost:8010/api/auth/me/"   # answers 401 when the backend is up

say() { printf '\n\033[1;34m==> %s\033[0m\n' "$1"; }
fail() { printf '\n\033[1;31mERROR: %s\033[0m\n' "$1"; exit 1; }

if [ "${1:-}" = "--stop" ]; then
  say "Stopping FAEMS"
  docker compose stop && echo "Stopped. Your data is kept; run ./start.sh to start again."
  exit 0
fi

BUILD_FLAGS="--build"
[ "${1:-}" = "--rebuild" ] && BUILD_FLAGS="--build --force-recreate"

# 1. Docker must be running (starts Docker Desktop on Windows if needed)
say "Checking Docker"
if ! docker info >/dev/null 2>&1; then
  echo "Docker is not running - starting Docker Desktop..."
  for p in "/c/Program Files/Docker/Docker/Docker Desktop.exe" "/c/Program Files (x86)/Docker/Docker/Docker Desktop.exe"; do
    [ -f "$p" ] && { powershell.exe -NoProfile -Command "Start-Process '$(cygpath -w "$p")'" >/dev/null 2>&1; break; }
  done
  for i in $(seq 1 60); do
    docker info >/dev/null 2>&1 && break
    sleep 5
  done
  docker info >/dev/null 2>&1 || fail "Docker did not start. Open Docker Desktop manually, wait until it says 'running', then run ./start.sh again."
fi

[ -f .env ] || fail ".env file is missing. Copy .env.example to .env and fill in the values (see DEPLOYMENT.md)."

# 2. Local AI model (Ollama) used to read attachments - optional, the system works without it
say "Checking the AI model (Ollama)"
if command -v ollama >/dev/null 2>&1; then
  if ! curl -s -m 3 http://localhost:11434/api/tags >/dev/null 2>&1; then
    echo "Starting Ollama..."
    (ollama serve >/dev/null 2>&1 &)
    sleep 4
  fi
  # Load the model into memory now so the first upload isn't slow (runs in background)
  (curl -s -m 600 http://localhost:11434/api/generate -d '{"model":"llama3.1:8b","prompt":"hi","stream":false,"keep_alive":"24h","options":{"num_predict":1}}' >/dev/null 2>&1 &)
  echo "Ollama is ready (model is warming up in the background)."
else
  echo "Ollama not found - attachment analysis will use the simpler built-in reader."
fi

# 3. Start everything
say "Starting database, storage, backend and frontend (first time can take a few minutes)"
# shellcheck disable=SC2086
docker compose up -d $BUILD_FLAGS || fail "docker compose could not start. Run 'docker compose logs' to see why."

# 4. Wait until the backend answers
say "Waiting for the backend to be ready"
ready=0
for i in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w "%{http_code}" -m 3 "$BACKEND_CHECK" 2>/dev/null || true)
  if [ "$code" = "401" ] || [ "$code" = "200" ]; then ready=1; break; fi
  printf '.'
  sleep 3
done
echo
[ "$ready" = "1" ] || fail "Backend did not come up. Run: docker compose logs backend --tail 50"

say "FAEMS is running"
echo "  Website : $FRONTEND_URL"
echo "  Stop    : ./start.sh --stop"
echo "  Logs    : docker compose logs -f backend"

# 5. Open the website
if command -v start >/dev/null 2>&1; then start "" "$FRONTEND_URL" >/dev/null 2>&1
elif command -v powershell.exe >/dev/null 2>&1; then powershell.exe -NoProfile -Command "Start-Process '$FRONTEND_URL'" >/dev/null 2>&1
elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$FRONTEND_URL" >/dev/null 2>&1
fi
exit 0
