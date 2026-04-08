#!/usr/bin/env bash
# Deploy to AWS EC2: pull latest code and rebuild Docker containers.
# Reads DEPLOY_HOST, DEPLOY_USER, DEPLOY_KEY, DEPLOY_DIR from repo-root .env (or environment).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Load repo-root .env if present
if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

DEPLOY_HOST="${DEPLOY_HOST:-}"
DEPLOY_USER="${DEPLOY_USER:-ec2-user}"
DEPLOY_KEY="${DEPLOY_KEY:-}"
DEPLOY_DIR="${DEPLOY_DIR:-/home/${DEPLOY_USER}/Situate-Vancouver}"

# ── Validate ──────────────────────────────────────────────────────────────────

if [[ -z "$DEPLOY_HOST" ]]; then
  echo "deploy: error: DEPLOY_HOST is not set." >&2
  echo "  Add it to your repo-root .env:" >&2
  echo "    DEPLOY_HOST=ec2-xx-xx-xx-xx.compute-1.amazonaws.com" >&2
  exit 1
fi

SSH_OPTS=(-o StrictHostKeyChecking=no -o ConnectTimeout=10)
if [[ -n "$DEPLOY_KEY" ]]; then
  DEPLOY_KEY="${DEPLOY_KEY/#\~/$HOME}"   # expand ~ manually
  if [[ ! -f "$DEPLOY_KEY" ]]; then
    echo "deploy: error: key file not found: $DEPLOY_KEY" >&2
    exit 1
  fi
  SSH_OPTS+=(-i "$DEPLOY_KEY")
fi

TARGET="${DEPLOY_USER}@${DEPLOY_HOST}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Deploying to $TARGET"
echo "  Directory : $DEPLOY_DIR"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Deploy ────────────────────────────────────────────────────────────────────

ssh "${SSH_OPTS[@]}" "$TARGET" bash -s -- "$DEPLOY_DIR" << 'REMOTE'
  set -euo pipefail
  DEPLOY_DIR="$1"

  if [[ ! -d "$DEPLOY_DIR" ]]; then
    echo "deploy: error: directory not found on server: $DEPLOY_DIR" >&2
    exit 1
  fi

  cd "$DEPLOY_DIR"

  echo ""
  echo "▸ Pulling latest code..."
  git pull --ff-only

  echo ""
  echo "▸ Rebuilding and restarting containers..."
  docker compose up --build -d

  echo ""
  echo "▸ Removing unused images..."
  docker image prune -f

  echo ""
  echo "▸ Running DB migrations..."
  docker compose exec -T backend python manage.py migrate --no-input

  echo ""
  echo "▸ Container status:"
  docker compose ps
REMOTE

echo ""
echo "✓ Deploy complete."
