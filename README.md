# Stock Analysis System

A full-stack Taiwan stock market data platform with JWT authentication, real-time quotes, historical price charts, and personalized watchlists.

## Overview

- **Backend**: FastAPI (Python 3.12) + SQLAlchemy + Alembic + PostgreSQL
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS + Zustand + TanStack Query
- **Auth**: JWT access/refresh tokens with blacklist logout
- **Data**: Taiwan stock data powered by `twstock`
- **Scheduler**: APScheduler for daily historical price sync

## Features

- **User Authentication** — register, login, logout, token refresh
- **Password Reset** — forgot-password flow with token-based email reset
- **Guest Mode** — browse stocks and stock details without an account; watchlist features require login
- **Stock Search** — search TWSE/TPEx stocks by symbol or name
- **Real-time Quotes** — fetch live stock quotes
- **Historical Prices** — view OHLCV historical data with date range filtering
- **Watchlists** — create personal watchlists and track stock quotes
- **Daily Sync** — automatic background sync of historical prices (configurable)
- **Portfolio Management** — track buy/sell transactions and view positions with P&L
- **Price Alerts** — set target price alerts with real-time notifications
- **Target Prices** — analyst target prices and ratings (admin-managed)
- **Stock Fundamentals** — market cap, P/E, dividend yield, and key financial metrics
- **Batch Summary** — enriched summaries for multiple stocks in a single request
- **Real-time SSE** — Server-Sent Events streaming for live quote updates
- **Content Visibility** — per-user toggles for UI components
- **PWA Support** — installable progressive web app with offline assets
- **Admin Dashboard** — role-based admin panel for user management and content visibility
- **Responsive UI** — modern SPA built with React, Tailwind CSS, and Framer Motion animations

## Project Structure

```
.
├── app/                        # FastAPI backend
│   ├── main.py                 # Application entry point
│   ├── config.py               # Pydantic settings
│   ├── database.py             # SQLAlchemy engine & session
│   ├── models.py               # Database models
│   ├── schemas.py              # Pydantic request/response schemas
│   ├── security.py             # Password hashing & JWT utils
│   ├── dependencies.py         # FastAPI dependencies
│   ├── scheduler.py            # Background job scheduler
│   ├── routers/
│   │   ├── auth.py             # Authentication endpoints
│   │   ├── stocks.py           # Stock data endpoints
│   │   ├── watchlists.py       # Watchlist endpoints
│   │   ├── portfolio.py        # Portfolio transactions & positions
│   │   ├── alerts.py           # Price alerts
│   │   ├── target_prices.py    # Analyst target prices
│   │   ├── admin.py            # Admin user management
│   │   ├── content_visibility.py # UI component visibility settings
│   │   └── events.py           # SSE real-time quote streams
│   └── services/
│       ├── stock_data.py       # Taiwan stock data service
│       ├── fundamentals.py     # Stock fundamental data
│       ├── recommendations.py  # Stock analysis & recommendations
│       └── summaries.py        # Batch stock summaries
├── frontend/                   # React frontend
│   ├── src/
│   │   ├── pages/              # Page components (Dashboard, Stocks, Watchlists, Auth, Portfolio, Alerts, Profile, Admin)
│   │   ├── components/         # Shared components & stock-specific cards
│   │   ├── hooks/              # Custom React hooks (PWA, haptics, SSE, search)
│   │   ├── api/                # API clients
│   │   ├── stores/             # Zustand state stores
│   │   ├── types/              # TypeScript types
│   │   └── lib/                # Utilities
│   └── dist/                   # Production build output
├── tests/                      # Backend test suite (pytest)
├── alembic/                    # Database migrations
├── requirements.txt            # Python dependencies
├── .env                        # Environment variables
└── Dockerfile                  # Container image
```

## Quick Start

### Prerequisites

- Python 3.12+
- Node.js 20+
- PostgreSQL 15+

### 1. Database Setup

Create a PostgreSQL database and set the `postgres` user password:

```bash
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD '1111';"
sudo -u postgres psql -c "CREATE DATABASE stock_analysis;"
```

Update `.env`:

```env
DATABASE_URL=postgresql://postgres:1111@localhost:5432/stock_analysis
SECRET_KEY=your-secret-key-here
```

Run migrations:

```bash
python3 -m alembic upgrade head
```

### CLI Commands

```bash
# Promote a user to admin
python -m app.cli make-admin --username alice
python -m app.cli make-admin --email alice@example.com

# Sync stock list from twstock
python -m app.cli sync-list

# Backfill historical prices
python -m app.cli backfill --days 365 --workers 4
```

### 2. Backend Setup

```bash
# Install dependencies
pip3 install -r requirements.txt

# Run the server
uvicorn app.main:app --reload --port 8000
```

API docs will be available at `http://localhost:8000/docs`.

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start dev server (proxies API to localhost:8000)
npm run dev
```

The frontend will be available at `http://localhost:5173`.

### 4. Production Build

```bash
cd frontend
npm run build
```

The FastAPI backend will automatically serve the built frontend from `frontend/dist/`.

## API Endpoints

All application API routes are mounted under `/api/v1`. Route paths are resource-oriented; filtering uses query parameters and state changes use HTTP methods instead of action names. Error responses use FastAPI's default JSON shape, for example `{"detail": "..."}`.

Common status codes:

| Status | Meaning |
|--------|---------|
| 200 | Resource returned or updated |
| 201 | Resource created |
| 204 | Resource deleted with no response body |
| 400 | Invalid state transition or date range |
| 401 | Missing or invalid authentication |
| 404 | Resource not found |
| 422 | Request validation failed |
| 503 | Upstream stock data source unavailable |

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/users` | Create a new user |
| GET | `/api/v1/users/me` | Get current user profile |
| POST | `/api/v1/sessions` | Create a session and get tokens |
| DELETE | `/api/v1/sessions/current` | Delete the current session |
| POST | `/api/v1/token-refreshes` | Rotate a refresh token and get a new token pair |
| POST | `/api/v1/password-reset-requests` | Request a password reset token |
| POST | `/api/v1/password-resets` | Reset password using a valid token |
| PATCH | `/api/v1/users/me` | Update current user profile |
| POST | `/api/v1/users/me/change-password` | Change password (requires current password) |

### Admin

All admin endpoints require an authenticated user with `role: "admin"`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/admin/users` | List all users (paginated) |
| GET | `/api/v1/admin/users/{id}` | Get user details |
| PATCH | `/api/v1/admin/users/{id}` | Update user role or active status |
| DELETE | `/api/v1/admin/users/{id}` | Delete a user |

Target price creation (`POST /api/v1/stocks/{symbol}/target-prices`) is also admin-only.

### Content Visibility (Admin)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/admin/content-visibility` | List global content visibility settings |
| PATCH | `/api/v1/admin/content-visibility/{key}` | Update visibility for a content key |

### Stocks

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/stocks?q={query}` | List or search stocks by symbol/name |
| GET | `/api/v1/stocks/{symbol}` | Get stock details |
| GET | `/api/v1/stocks/{symbol}/quotes/latest` | Get latest quote |
| GET | `/api/v1/stocks/{symbol}/prices` | Get historical prices |
| GET | `/api/v1/stocks/{symbol}/sync-status` | Get historical price sync status |
| GET | `/api/v1/stocks/{symbol}/peers` | Get peer stocks in the same industry |
| GET | `/api/v1/stocks/{symbol}/target-prices` | Get analyst target prices |
| GET | `/api/v1/stocks/batch/summary` | Get enriched summaries for multiple stocks |
| POST | `/api/v1/stock-sync-jobs` | Create a historical price sync job (auth required) |
| GET | `/api/v1/stock-sync-jobs/{id}` | Get a historical price sync job (auth required) |

> **Note:** Historical prices support JSON (default) and CSV export via `?format=csv`.

All `GET /api/v1/stocks*` endpoints are publicly accessible without authentication.

### Watchlists

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/watchlists` | List user's watchlists |
| POST | `/api/v1/watchlists` | Create a watchlist |
| GET | `/api/v1/watchlists/{id}` | Get watchlist details |
| PATCH | `/api/v1/watchlists/{id}` | Update a watchlist |
| DELETE | `/api/v1/watchlists/{id}` | Delete a watchlist |
| PUT | `/api/v1/watchlists/{id}/items/{symbol}` | Ensure stock is in watchlist |
| DELETE | `/api/v1/watchlists/{id}/items/{symbol}` | Remove stock from watchlist |
| GET | `/api/v1/watchlists/{id}/quotes` | Get quotes for watchlist stocks |

### Portfolio

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/portfolio/transactions` | Record a buy or sell transaction |
| GET | `/api/v1/portfolio/positions` | List all positions with P&L |
| GET | `/api/v1/portfolio/positions/{symbol}` | Get position for a specific stock |

### Price Alerts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/price-alerts` | List price alerts (optionally `?active_only=true`) |
| POST | `/api/v1/price-alerts` | Create a price alert |
| PATCH | `/api/v1/price-alerts/{id}` | Update an alert (e.g. toggle active) |
| DELETE | `/api/v1/price-alerts/{id}` | Delete a price alert |

### Events (SSE)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/events/quotes?symbols=2330,2317` | Stream real-time quotes via Server-Sent Events |

### Content Visibility

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/content-visibility` | Get effective visibility for current user |

## Testing

Run the backend test suite:

```bash
python3 -m pytest tests/ -v
```

The project includes 275+ tests covering authentication, security, admin access, stocks, watchlists, target prices, and schema validation.

## PR Review Cleanup

After blocker-fix commits land on a pull request, maintainers should clean up stale review state before merging. PR #12 is the motivating example: the requested changes were fixed in later commits and CI passed, but older review state still needed explicit cleanup. Use this workflow for any PR with similar stale review threads.

### Classify Review Threads

Treat a review thread as outdated when it is anchored to code that no longer exists, the exact requested change is covered by a later commit, and the current diff plus tests demonstrate the fix. A thread is still actionable when the same behavior is still present, the comment asks for a decision that has not been made, the test coverage is still missing, or the reviewer explicitly asked for follow-up evidence that has not been provided.

When in doubt, leave the thread open and reply with the commit, test, or rationale that appears to address it. Do not resolve a thread only because CI is green; CI confirms checks, not reviewer intent.

### Who Cleans Up

The PR author should push the blocker-fix commits and summarize which review items were addressed. The maintainer who owns the review should resolve outdated inline threads, dismiss their own stale `CHANGES_REQUESTED` review when its blockers are fixed, or request a new review if the change set has materially shifted. Other maintainers should avoid dismissing another maintainer's review unless they own repository review policy and the fix evidence is clear.

Automated review comments can be resolved when they are outdated and covered by the current diff. Human comments that involve product, security, or architecture judgment should stay open until the reviewer or repo maintainer confirms the resolution.

### Merge Readiness Checklist

- Current branch is pushed and the PR head SHA matches the intended local commit.
- Required CI checks are complete and passing.
- GitHub reports the PR as mergeable and the merge state is clean.
- Review decision is not `CHANGES_REQUESTED`; stale requested-change reviews have been dismissed with a short reason.
- Unresolved review threads are either resolved as outdated/fixed or intentionally left open with a written explanation.
- Follow-up work that is not required for this merge is tracked in separate issues.

## Docker

Build and run with Docker:

```bash
docker build -t stock-analysis .
docker run -p 8080:8080 --env-file .env stock-analysis
```

## Configuration

All configuration is managed through environment variables in `.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | — | PostgreSQL connection string |
| `SECRET_KEY` | random | JWT signing secret |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | 15 | Access token lifetime |
| `REFRESH_TOKEN_EXPIRE_DAYS` | 7 | Refresh token lifetime |
| `CORS_ORIGINS` | * | Allowed CORS origins |
| `STOCK_DAILY_SYNC_ENABLED` | true | Enable daily price sync |
| `STOCK_DAILY_SYNC_HOUR` | 16 | Daily sync hour (24h) |
| `STOCK_DAILY_SYNC_MINUTE` | 30 | Daily sync minute |
| `STOCK_SYNC_MAX_CONCURRENT` | 8 | Max concurrent workers for sync fallback |
| `STOCK_SYNC_RATE_LIMIT_SECONDS` | 0.3 | Delay between fallback sync requests |
| `AI_ANALYSIS_CACHE_TTL_SECONDS` | 300 | Short-term AI analysis cache TTL; set to 0 to disable |
| `AI_ANALYSIS_PROVIDER_TIMEOUT_SECONDS` | 20.0 | DeepSeek provider call timeout per background job |
| `AI_ANALYSIS_MAX_CONCURRENT_JOBS` | 2 | Max AI analysis provider jobs running at once |
| `AI_ANALYSIS_MAX_QUEUED_JOBS` | 20 | Max AI analysis provider jobs waiting to run |
| `AI_ANALYSIS_CIRCUIT_FAILURE_THRESHOLD` | 3 | Consecutive provider failures before opening the circuit |
| `AI_ANALYSIS_CIRCUIT_COOLDOWN_SECONDS` | 60 | Seconds to reject new provider work after the circuit opens |
| `AI_ANALYSIS_JOB_STALE_SECONDS` | 300 | Seconds before an unfinished AI analysis job is expired after interruption |

## AI Analysis Health Signals

AI analysis emits structured log fields for degraded context and provider health. Monitor the `event` field and alert on repeated warnings:

| Event | Level | Key fields | Meaning |
|-------|-------|------------|---------|
| `ai_analysis.context_degraded` | warning | `symbol`, `failure_category` | Analysis was queued without complete fundamentals context. Categories are `fundamentals_unavailable` and `fundamentals_exception`. |
| `ai_analysis.provider_failure` | warning | `symbol`, `provider`, `failure_category`, `request_id` when available | DeepSeek analysis did not produce a valid response. Categories are `missing_api_key`, `timeout`, `invalid_json`, `invalid_action`, `request_id_mismatch`, `provider_exception`, and `empty_response`. |
| `ai_analysis.provider_success` | info | `symbol`, `provider`, `request_id`, `action` | DeepSeek returned a validated AI analysis. |

These logs intentionally omit API keys, full prompts, and full provider responses.

Frontend builds use these Vite variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_ORIGIN` | same origin | Backend origin, for example `https://backend.example.com` |
| `VITE_API_PREFIX` | `/api/v1` | API path prefix appended to `VITE_API_ORIGIN` |
| `VITE_API_URL` | — | Backward-compatible API base. If it omits `/api/v1`, the frontend appends `VITE_API_PREFIX`. |

## Tech Stack

**Backend**
- FastAPI
- SQLAlchemy 2.0
- Alembic
- PostgreSQL (psycopg2)
- python-jose + bcrypt
- APScheduler
- twstock
- yfinance
- slowapi (rate limiting)

**Frontend**
- React 19
- TypeScript
- Vite
- Tailwind CSS
- Zustand (state management)
- TanStack Query (data fetching)
- React Hook Form + Zod (forms & validation)
- React Router v7
- Lightweight Charts
- Lucide React
- Sonner (toasts)

## License

MIT
