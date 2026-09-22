#!/usr/bin/env bash
# One-command dev server. Uses the project venv so it never
# depends on (or pollutes) the system Python.
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -x .venv/bin/uvicorn ]; then
  python3 -m venv .venv
  .venv/bin/pip install -r requirements.txt
fi

exec .venv/bin/uvicorn app.main:app --reload --port "${PORT:-8000}"