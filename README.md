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
