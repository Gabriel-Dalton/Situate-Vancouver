#!/usr/bin/env bash
# Start FastAPI (ai-service), Vite (frontend), then Django; all bind/port and proxy
# settings come from repo-root `.env` (sourced below with `set -a`).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
else
  echo "dev-run: warning: no repo-root .env — copy .env.example to .env" >&2
fi

if [[ -z "${OPENAI_API_KEY:-}" ]]; then
  echo "dev-run: warning: OPENAI_API_KEY is unset — /incidents/query and /incidents/report return 503 until set in repo-root .env" >&2
fi

DJANGO_DEV_HOST="${DJANGO_DEV_HOST:-127.0.0.1}"
DJANGO_DEV_PORT="${DJANGO_DEV_PORT:-1111}"
AI_DEV_HOST="${AI_DEV_HOST:-127.0.0.1}"
AI_DEV_PORT="${AI_DEV_PORT:-8001}"
FRONTEND_DEV_HOST="${FRONTEND_DEV_HOST:-127.0.0.1}"
FRONTEND_DEV_PORT="${FRONTEND_DEV_PORT:-5173}"

# Django calls FastAPI using AI_SERVICE_URL; it must match this script's uvicorn bind. Listening on
# 0.0.0.0 still means "connect to" 127.0.0.1 from the same host for outbound HTTP.
_ai_service_connect_host="${AI_DEV_HOST}"
if [[ "${_ai_service_connect_host}" == "0.0.0.0" ]]; then
  _ai_service_connect_host="127.0.0.1"
fi
export AI_SERVICE_URL="http://${_ai_service_connect_host}:${AI_DEV_PORT}"

# Drop leftover listeners from a prior `make run` so ports match .env (e.g. Vite stays on 5173).
free_listening_port() {
  local port="$1"
  local label="${2:-TCP $port}"
  if ! command -v lsof >/dev/null 2>&1; then
    echo "dev-run: warning: lsof not found — cannot free $label before start" >&2
    return 0
  fi
  local round
  for round in 1 2; do
    local found=0
    while read -r pid; do
      [[ -z "$pid" ]] && continue
      found=1
      if [[ "$round" -eq 1 ]]; then
        echo "dev-run: stopping listener on $label (port $port, PID $pid)" >&2
        kill "$pid" 2>/dev/null || true
      else
        kill -9 "$pid" 2>/dev/null || true
      fi
    done < <(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)
    [[ "$found" -eq 0 ]] && break
    sleep 0.4
  done
}

free_listening_port "$AI_DEV_PORT" "AI (uvicorn)"
free_listening_port "$FRONTEND_DEV_PORT" "frontend (Vite)"
free_listening_port "$DJANGO_DEV_PORT" "Django"

cleanup() {
  if [[ -n "${FE_PID:-}" ]] && kill -0 "$FE_PID" 2>/dev/null; then
    kill "$FE_PID" 2>/dev/null || true
    wait "$FE_PID" 2>/dev/null || true
  fi
  if [[ -n "${AI_PID:-}" ]] && kill -0 "$AI_PID" 2>/dev/null; then
    kill "$AI_PID" 2>/dev/null || true
    wait "$AI_PID" 2>/dev/null || true
  fi
  if [[ -n "${CELERY_PID:-}" ]] && kill -0 "$CELERY_PID" 2>/dev/null; then
    kill "$CELERY_PID" 2>/dev/null || true
    wait "$CELERY_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

cd "$ROOT/ai-service"
if [[ -f .venv/bin/python ]]; then
  AI_PY="./.venv/bin/python"
elif command -v python3 >/dev/null 2>&1; then
  AI_PY="python3"
else
  AI_PY="python"
fi
"$AI_PY" -m uvicorn app.main:app --host "$AI_DEV_HOST" --port "$AI_DEV_PORT" &
AI_PID=$!

if ! command -v npm >/dev/null 2>&1; then
  echo "dev-run: error: npm not found — install Node.js to run the frontend" >&2
  exit 1
fi
if [[ ! -d "$ROOT/frontend/node_modules" ]]; then
  echo "dev-run: error: frontend/node_modules missing — run: cd frontend && npm install" >&2
  exit 1
fi
if [[ ! -d "$ROOT/frontend/node_modules/maplibre-gl" ]]; then
  echo "dev-run: error: frontend dependencies incomplete (e.g. maplibre-gl) — run: cd frontend && npm install" >&2
  exit 1
fi

cd "$ROOT/frontend"
npm run dev -- --host "$FRONTEND_DEV_HOST" --port "$FRONTEND_DEV_PORT" &
FE_PID=$!

cd "$ROOT/backend"
if [[ -f .venv/bin/python ]]; then
  DJ_PY="./.venv/bin/python"
elif command -v python3 >/dev/null 2>&1; then
  DJ_PY="python3"
else
  DJ_PY="python"
fi

celery -A config worker --beat --loglevel=warning --pool=solo \
  --scheduler django_celery_beat.schedulers:DatabaseScheduler &
CELERY_PID=$!

"$DJ_PY" manage.py runserver "$DJANGO_DEV_HOST:$DJANGO_DEV_PORT"
