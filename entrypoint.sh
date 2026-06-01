#!/usr/bin/env sh
set -e

# Apply database migrations on startup. Safe to re-run; no-op when already current.
echo "Running database migrations..."
alembic upgrade head

# Cloud Run injects $PORT (defaults to 8080). Single worker keeps the in-process
# APScheduler and the AI-analysis ThreadPool/job-queue state consistent.
echo "Starting uvicorn on port ${PORT:-8080}..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8080}" --workers 1
