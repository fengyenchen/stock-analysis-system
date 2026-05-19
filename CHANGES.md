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
