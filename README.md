# Stock Analysis System

A Taiwan stock tracking and analysis app with a FastAPI backend and a React/Vite frontend.

## Features

- JWT authentication with refresh tokens and user profiles
- Taiwan stock list, quotes, historical prices, fundamentals, and recommendations
- Watchlists, portfolio transactions, target prices, and price alerts
- Optional DeepSeek-powered AI stock summaries
- Admin user management and content visibility controls
- Daily stock data sync scheduler and CLI backfill tools
- PWA-ready frontend for desktop and mobile use

## Tech Stack

- Backend: FastAPI, SQLAlchemy, Alembic, APScheduler
- Frontend: React, TypeScript, Vite, TanStack Query, Zustand
- Data: PostgreSQL or SQLite, `twstock`, `yfinance`

## Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
alembic upgrade head
```

Edit `.env` before running in production. `DATABASE_URL` defaults to PostgreSQL; SQLite is also supported, for example:

```env
DATABASE_URL=sqlite:///./app.db
```

## Run

Backend:

```bash
uvicorn app.main:app --reload
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. API docs are available at `http://localhost:8000/docs`.

## Data Tasks

```bash
python -m app.cli sync-list
python -m app.cli backfill --days 365 --workers 4
python -m app.cli make-admin --email user@example.com
```

AI analysis requires `DEEPSEEK_API_KEY` in `.env`.

## Deployment

The app is deployed as **frontend on Vercel + backend on Google Cloud Run + Neon Postgres**. The backend is a stateful, always-on service (APScheduler daily sync + an in-process AI-analysis job queue), so it runs as a long-lived container — not a serverless function. Cloud Run is therefore pinned to a single instance (`--min-instances 1 --max-instances 1`).

| Component | Platform | Notes |
| --- | --- | --- |
| Frontend | Vercel | Static Vite/PWA build, `frontend/vercel.json` (SPA rewrite) |
| Backend | Cloud Run (`asia-east1`) | `Dockerfile` + `entrypoint.sh` (runs `alembic upgrade head` then uvicorn) |
| Database | Neon Postgres | Pooler endpoint with `?sslmode=require` |

Deployment files: `Dockerfile`, `entrypoint.sh`, `.dockerignore`, `.gcloudignore`, `frontend/vercel.json`, `frontend/.env.production.example`.

**Live URLs**

- Frontend: <https://frontend-nine-self-88.vercel.app>
- Backend: <https://stock-analysis-api-813628638020.asia-east1.run.app> (`/health`, `/docs`)

### Config

- Backend secrets (`DATABASE_URL`, `DEEPSEEK_API_KEY`, `SECRET_KEY`) live in Google Secret Manager and are wired in via `--set-secrets`. Set `ENVIRONMENT=production` and `CORS_ORIGINS=<frontend origin>` as plain env vars. `CORS_ORIGINS` must be the explicit Vercel origin (not `*`), because the API sends `Access-Control-Allow-Credentials: true`.
- Frontend reads `VITE_API_URL` (the Cloud Run base URL) at build time; the API client appends `/api/v1` automatically. This also drives the SSE quote stream origin.

### Redeploy

```bash
# Backend (from repo root)
gcloud run deploy stock-analysis-api --source . --region asia-east1

# Frontend (from frontend/)
vercel --prod
```
