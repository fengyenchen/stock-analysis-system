# victor-backend Branch Changelog

This document summarizes the major features and changes delivered in the `victor-backend` branch.

---

## 1. Portfolio Management

**Files:** `app/routers/portfolio.py`, `frontend/src/pages/PortfolioPage.tsx`

- **Backend:** New `PortfolioTransaction` and position tracking endpoints.
  - `POST /api/v1/portfolio/transactions` — record buy/sell transactions.
  - `GET /api/v1/portfolio/positions` — list all holdings with calculated P&L using live quotes.
  - `GET /api/v1/portfolio/positions/{symbol}` — single-stock position detail.
- **Frontend:** Dedicated portfolio page to view holdings, transaction history, and performance.

---

## 2. Price Alerts

**Files:** `app/routers/alerts.py`, `frontend/src/pages/AlertsPage.tsx`

- `GET /api/v1/price-alerts` — list user alerts with optional `active_only` filter.
- `POST /api/v1/price-alerts` — create alerts with conditions (`above` / `below`).
- `PATCH /api/v1/price-alerts/{id}` — edit or deactivate alerts.
- `DELETE /api/v1/price-alerts/{id}` — remove alerts.
- Frontend alerts page for managing notification preferences.

---

## 3. Target Prices & Analyst Ratings

**Files:** `app/routers/target_prices.py`, `app/models.py`

- New `StockTargetPrice` model stores analyst ratings (`buy` / `hold` / `sell`), target prices, and report dates.
- `GET /api/v1/stocks/{symbol}/target-prices` — publicly readable.
- `POST /api/v1/stocks/{symbol}/target-prices` — **admin-only** creation.

---

## 4. User Profile & Security

**Files:** `app/routers/auth.py`, `frontend/src/pages/ProfilePage.tsx`

- `PATCH /api/v1/users/me` — update username and email with uniqueness checks.
- `POST /api/v1/users/me/change-password` — requires current password verification.
- Auth endpoints now include **rate limiting** via `slowapi`:
  - Register: 5/minute
  - Login: 10/minute
  - Token refresh: 10/minute
  - Password reset: 3–5/minute

---

## 5. Admin User Management

**Files:** `app/routers/admin.py`, `frontend/src/pages/AdminDashboardPage.tsx`

- `GET /api/v1/admin/users` — paginated user list.
- `GET /api/v1/admin/users/{id}` — single user detail.
- `PATCH /api/v1/admin/users/{id}` — update role (`user`/`admin`) and active status.
- Self-protection: admins cannot demote or deactivate themselves via these endpoints.
- CLI helper: `python -m app.cli make-admin --username alice`.

---

## 6. Content Visibility

**Files:** `app/routers/content_visibility.py`, `frontend/src/hooks/useContentVisibility.ts`

- Global and per-user overrides for UI component visibility.
- Supported keys: `recommendation_banner`, `metrics_strip`, `price_chart`, `technical_indicators`, `analysis_points`, `quick_stats_grid`, `key_metrics_grid`, `analyst_consensus`, `related_stocks`, `financial_health_scores`, `quick_actions`, `signal_summary`, `risk_assessment`, `support_resistance`, `peer_comparison`, `sync_csv_actions`, `alert_form`.
- `GET /api/v1/content-visibility` — returns effective settings for the authenticated user.

---

## 7. Real-Time Quote Streaming (SSE)

**Files:** `app/routers/events.py`, `frontend/src/hooks/useSSEQuotes.ts`

- `GET /api/v1/events/quotes?symbols=2330,2317&interval=30` — Server-Sent Events stream.
- Async generator fetches live quotes on an interval and streams JSON payloads.
- Frontend hook consumes the stream for live dashboard/watchlist updates.

---

## 8. Stock Data Enhancements

**Files:** `app/routers/stocks.py`, `app/services/summaries.py`, `app/services/fundamentals.py`

- **Batch Summary:** `GET /api/v1/stocks/batch/summary?symbols=2330,2317` — enriched multi-stock response (price, change %, recommendation, sparkline data) up to 50 symbols.
- **Peer Comparison:** `GET /api/v1/stocks/{symbol}/peers` — returns stocks in the same industry.
- **CSV Export:** `GET /api/v1/stocks/{symbol}/prices?format=csv` — download historical prices as CSV.
- **Fundamentals:** `StockFundamental` model added (market cap, P/E, EPS, dividend yield, ROE, beta, etc.).
- **ETF Support:** `is_etf` flag added to `Stock` model.

---

## 9. PWA Support

**Files:** `frontend/vite.config.ts`, `frontend/public/`, `frontend/index.html`

- `vite-plugin-pwa` configured with auto-update service worker.
- Manifest: `TW Stock Tracker` — installable on mobile and desktop.
- Icons: 192×192 and 512×512 PNGs plus Apple touch icon.
- Standalone display mode with portrait orientation.

---

## 10. Frontend Overhaul

**Files:** `frontend/src/components/`, `frontend/src/pages/`, `frontend/src/hooks/`

- **Responsive Design:** Mobile-first layout with `BottomTabBar` and `DesktopNavbar`.
- **New Stock Detail Components:** `PriceChart`, `TechnicalIndicators`, `AnalysisPoints`, `KeyMetricsGrid`, `AnalystConsensus`, `FinancialHealthScores`, `RiskAssessment`, `SupportResistance`, `PeerComparison`, `SignalSummary`, `RSIGauge`, `VolumeAnalysisCard`, `RecBanner`, `QuickActions`, `MiniSparkline`, etc.
- **Animations:** Framer Motion page transitions and scroll-reveal effects.
- **Theming:** `ThemeProvider` with dark/light mode support.
- **Utilities:** `useHaptic`, `useOnlineStatus`, `useScrollReveal`, `useStockSearch`, `useMediaQuery`.
- **Query Persistence:** TanStack Query with `idb-keyval` persistent cache.

---

## 11. Infrastructure & Reliability

**Files:** `app/main.py`, `app/limiter.py`, `app/config.py`

- **Request ID Middleware:** Every request gets a `X-Request-ID` header.
- **Rate Limiting:** `slowapi` integrated globally; auth endpoints have per-route limits.
- **Scheduler Lifespan:** Moved from `@app.on_event("startup")` to FastAPI `lifespan` context manager for graceful startup/shutdown.
- **Config:** `app_name` changed to `Taiwan Stock Analysis API`; sync fallback tuned (`0.3s` delay, `8` workers).

---

# Stock Sync Performance Optimization Report


## Summary

Historical price sync for Taiwan stocks was reduced from **~46.2 seconds** to **~1.2 seconds** (primary path) by replacing month-by-month HTTP fetching with a single-request Yahoo Finance integration. Fallback and reliability improvements were also applied.

---

## 1. Problem

- **Symptom:** First-time sync for any stock (e.g. `/stocks/00634R`) took ~46.2s.
- **Root cause:** `twstock` fetches historical data **month-by-month**. For a stock with ~196 months of history, the backend made ~196 HTTP requests, each with a 1-second sleep and limited to 5 concurrent workers.

---

## 2. Solution Overview

| Layer | Change | Impact |
|-------|--------|--------|
| **Primary fetcher** | Added `yfinance` fast path (1 request for all history) | **~97% faster** (~46s → ~1.2s) |
| **Fallback fetcher** | Reduced sleep (`1.0s` → `0.3s`), increased workers (`5` → `8`) | **~67% faster** if yfinance fails |
| **Reliability** | Fixed `db.rollback()` detached-instance crash on sync failure | Prevents 500 errors |
| **Frontend** | Added data-source attribution under the price chart | UX transparency |

---

## 3. Backend Changes

### 3.1 New dependency
**File:** `requirements.txt`
```diff
  twstock==1.5.1
+ yfinance==0.2.55
```

### 3.2 Yahoo Finance fast path
**File:** `app/services/stock_data.py`

- Added `_fetch_historical_yfinance(symbol, market, start, end)`:
  - Maps Taiwan stock symbols to Yahoo Finance tickers:
    - `TWSE` → `{symbol}.TW`
    - `TPEx` → `{symbol}.TWO`
  - Calls `yfinance.Ticker.history()` once to fetch all daily OHLCV data.
  - Returns rows as `namedtuple` objects compatible with existing `twstock` data processing.
  - Gracefully falls back to `twstock` on any exception or empty result.

- Modified `sync_historical_prices()`:
  - **Before:** Always used `twstock` month-by-month.
  - **After:** Tries `yfinance` first; only falls back to `twstock` if `all_rows` is empty.
  - Logs which fetcher was used (`via yfinance` or `via twstock`).

### 3.3 Fallback optimization
**File:** `app/config.py`
```diff
- stock_sync_rate_limit_seconds: float = 1.0
- stock_sync_max_concurrent: int = 5
+ stock_sync_rate_limit_seconds: float = 0.3
+ stock_sync_max_concurrent: int = 8
```

### 3.4 Bug fix: exception handling
**File:** `app/services/stock_data.py`

**Before:**
```python
except Exception as exc:
    db.rollback()
    status = _get_or_create_sync_status(db, stock)  # stock was expired → crash
    ...
```

**After:**
```python
except Exception as exc:
    stock = db.query(Stock).filter(Stock.symbol == symbol).first()
    if stock:
        status = _get_or_create_sync_status(db, stock)
        status.status = "failed"
        status.last_error = str(exc)[:500]
        db.commit()
    raise
```

This fixes a pre-existing `DetachedInstanceError` / `ObjectDeletedError` that occurred when `db.rollback()` expired the `stock` instance before the failure status could be written.

---

## 4. Test Changes

### 4.1 Fixed broken test
**File:** `tests/test_services_stock_data.py`

- `test_failed_sync_updates_status` was already failing before these changes due to the rollback bug above.
- Fixed by capturing `stock_id` before the sync call and asserting on the re-queried status afterward.

### 4.2 Added yfinance coverage
**File:** `tests/test_services_stock_data.py`

- Added `test_successful_sync_yfinance_fast_path` which mocks `_fetch_historical_yfinance` to return data and verifies the sync succeeds without touching `twstock`.

### 4.3 Updated existing tests
**Files:** `tests/test_services_stock_data.py`, `tests/test_stocks.py`

- Patched `_fetch_historical_yfinance` to return `[]` in tests that exercise the `twstock` fallback path, preventing accidental real network calls during test runs.

---

## 5. Frontend Changes

### 5.1 Data source attribution
**File:** `frontend/src/pages/StockDetailPage.tsx`

Added a small label below the price chart:

```tsx
{chartData.length > 0 && (
  <div className="flex items-center justify-between mt-2">
    <p className="text-[10px] text-muted-foreground">
      Data source: Yahoo Finance (primary) / Taiwan Stock Exchange (fallback)
    </p>
    {lastSyncDuration !== null && (
      <p className="text-xs text-muted-foreground">
        Last sync took {formatDuration(lastSyncDuration)}
      </p>
    )}
  </div>
)}
```

---

## 6. Performance Benchmarks

| Scenario | Requests | Time | Improvement |
|----------|----------|------|-------------|
| Old (twstock) | ~196 month requests | ~46.2s | baseline |
| New primary (yfinance) | **1** request | ~1.2s | **~97%** |
| New fallback (twstock) | ~196 month requests | ~15s | **~67%** |

Example for `00634R`:
- yfinance fetches **2,799 rows** (~11.5 years of daily data) in **~1.2 seconds**.
- Previous twstock approach took **~46 seconds** for the same stock.

---

## 7. Test Results

```
pytest tests/ -q
======================= 258 passed, 1 warning in 44.84s =======================
```

All backend tests pass. Frontend builds cleanly (`npm run build` → `✓ built in 229ms`).

---

## 8. Deployment Notes

1. **Install the new dependency:**
   ```bash
   pip install -r requirements.txt
   ```
   or rebuild the Docker image.

2. **Verify the fast path is active:**
   Check server logs after a sync. You should see:
   ```
   [00634R] synced 196 months → 2799 rows via yfinance (fetch 1.20s | db 0.15s | total 1.35s)
   ```
   If you see `via twstock`, yfinance is failing (most likely not installed or outbound requests to Yahoo are blocked).

3. **Rebuild frontend (optional but recommended):**
   ```bash
   cd frontend && npm run build
   ```
