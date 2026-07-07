#!/usr/bin/env bash
# The manual redeploy script (spec §10's chosen mechanism — a manual pull + PM2-reload
# script, not GitHub Actions automation). Run this by hand on the VPS after merging to
# main:
#
#   cd /opt/xo-duel && ./deploy/deploy.sh
#
# See docs/runbook.md for the full deploy/restart/logs/rollback picture.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

if [ ! -f .env ]; then
  echo ".env not found in $REPO_DIR — copy .env.example and fill in real values first." >&2
  exit 1
fi

echo "==> Pulling latest main"
git pull origin main

echo "==> Installing dependencies (npm ci — matches the lockfile exactly)"
npm ci

echo "==> Building the server"
npm run build --workspace server

echo "==> Running database migrations (idempotent — only applies new ones, DB-2)"
set -a
# shellcheck disable=SC1091
source .env
set +a
npm run migrate

echo "==> Starting/reloading PM2 (zero-downtime if already running)"
pm2 startOrReload deploy/ecosystem.config.cjs --update-env
pm2 save

echo "==> Health check"
sleep 2
if curl -fsS "http://127.0.0.1:${PORT:-3000}/api/health" > /dev/null; then
  echo "OK — /api/health responded."
else
  echo "WARNING: /api/health did not respond — check 'pm2 logs xo-duel-server'." >&2
  exit 1
fi

echo "==> Done."
