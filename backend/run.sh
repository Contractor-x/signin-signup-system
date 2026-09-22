#!/usr/bin/env bash
#
# Production launcher for the FastAPI backend (self-hosted).
# Uses gunicorn with uvicorn workers so multiple requests can run in parallel.
#
# Usage:
#   ./run.sh                      # serve on 0.0.0.0:8000
#   HOST=127.0.0.1 PORT=8080 ./run.sh
#
# Put this behind a reverse proxy (Caddy/Nginx) that terminates HTTPS if the
# frontend calls it from a different origin (cross-origin API calls).
set -euo pipefail

HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-8000}"
WORKERS="${WORKERS:-2}"

cd "$(dirname "$0")"

exec gunicorn app.main:app \
  --bind "${HOST}:${PORT}" \
  --workers "${WORKERS}" \
  --worker-class uvicorn.workers.UvicornWorker \
  --access-logfile -