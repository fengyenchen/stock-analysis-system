import asyncio
import threading
import logging
import time
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Iterable, Optional
from zoneinfo import ZoneInfo

from sqlalchemy.dialects.postgresql import insert as postgresql_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

import twstock
from twstock.stock import TPEXFetcher, TWSEFetcher

from app.config import settings
from app.models import Stock, StockPrice, StockSyncStatus

logger = logging.getLogger(__name__)

# Monkey-patch twstock to reuse a single requests.Session with connection pooling.
# The default get_session() creates a new Session per call → no keep-alive.
import requests
import twstock.proxy as _twstock_proxy

_shared_session = requests.Session()
_shared_session.mount("https://", _twstock_proxy._LegacyCertAdapter(pool_connections=20, pool_maxsize=20))
_shared_session.mount("http://", _twstock_proxy._LegacyCertAdapter(pool_connections=20, pool_maxsize=20))
_twstock_proxy.get_session = lambda: _shared_session


# ─── Helpers ──────────────────────────────────────────────

def _to_decimal(value, precision=2) -> Optional[Decimal]:
    if value is None or value == "-":
        return None
    try:
        return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    except Exception:
        return None


def _to_int(value) -> Optional[int]:
    if value is None or value == "-":
        return None
    try:
        return int(str(value).replace(",", ""))
    except Exception:
        return None


_rate_limit_lock: Optional[threading.Lock] = None


def set_rate_limit_lock(lock: Optional[threading.Lock]) -> None:
    """Set a global lock to coordinate rate limiting across threads."""
    global _rate_limit_lock
    _rate_limit_lock = lock


def _rate_limit():
    """Throttle historical data source requests."""
    if _rate_limit_lock is not None:
        with _rate_limit_lock:
            time.sleep(settings.stock_sync_rate_limit_seconds)
    else:
        time.sleep(settings.stock_sync_rate_limit_seconds)


def _taipei_today() -> date:
    return datetime.now(ZoneInfo("Asia/Taipei")).date()


def _parse_date(value: Optional[str], fallback: date) -> date:
    if not value:
        return fallback
    return date.fromisoformat(value)


def _iter_months(start: date, end: date) -> Iterable[tuple[int, int]]:
    current = date(start.year, start.month, 1)
    final = date(end.year, end.month, 1)
    while current <= final:
        yield current.year, current.month
        if current.month == 12:
            current = date(current.year + 1, 1, 1)
        else:
            current = date(current.year, current.month + 1, 1)


@dataclass
class StockSyncResult:
    symbol: str
    start: date
    end: date
    records_upserted: int
    records_skipped: int
    months_requested: int

    @property
    def message(self) -> str:
        return (
            f"Synced {self.records_upserted} price records for {self.symbol} "
            f"from {self.start.isoformat()} to {self.end.isoformat()}"
        )


def _get_or_create_sync_status(db: Session, stock: Stock) -> StockSyncStatus:
    status = db.query(StockSyncStatus).filter(StockSyncStatus.stock_id == stock.id).first()
    if status:
        return status

    status = StockSyncStatus(stock_id=stock.id, status="pending", records_upserted=0)
    db.add(status)
    db.flush()
    return status


# ─── Stock List Sync ──────────────────────────────────────

# Security types that twstock.realtime supports and we want to expose
_SUPPORTED_TYPES = {
    "股票",
    "ETF",
    "特別股",
    "臺灣存託憑證(TDR)",
    "受益證券-不動產投資信託",
    "創新板",
}


def sync_stock_list(db: Session) -> int:
    """Sync stocks table from twstock.codes. Returns count of added or updated stocks."""
    changed = 0
    seen_symbols = set()
    for code, info in twstock.codes.items():
        # Only include TWSE and TPEx listed stocks
        if info.market not in ("上市", "上櫃"):
            continue
        # Skip warrants, ETNs, and other unsupported securities
        if info.type not in _SUPPORTED_TYPES:
            continue
        market_map = {"上市": "TWSE", "上櫃": "TPEx"}
        values = {
            "name": info.name,
            "market": market_map.get(info.market, "TWSE"),
            "industry": info.group if info.group else None,
            "is_active": True,
        }
        seen_symbols.add(code)
        existing = db.query(Stock).filter(Stock.symbol == code).first()
        if existing:
            if any(getattr(existing, key) != value for key, value in values.items()):
                for key, value in values.items():
                    setattr(existing, key, value)
                changed += 1
            continue

        db.add(Stock(symbol=code, **values))
        changed += 1

    inactive_count = (
        db.query(Stock)
        .filter(Stock.is_active == True, Stock.symbol.notin_(seen_symbols))
        .update({Stock.is_active: False}, synchronize_session=False)
        if seen_symbols
        else 0
    )
    changed += inactive_count
    db.commit()
    return changed


# ─── Historical Price Sync ────────────────────────────────

def _fetch_month_with_fetcher(fetcher, symbol: str, year: int, month: int) -> list:
    """Synchronous month fetch using a reusable fetcher."""
    time.sleep(settings.stock_sync_rate_limit_seconds)
    result = fetcher.fetch(year, month, symbol)
    return result.get("data", [])


def _fetch_historical_yfinance(symbol: str, market: str, start: date, end: date) -> list:
    """Fetch historical prices via Yahoo Finance in a single request.

    Returns a list of namedtuple objects compatible with twstock data rows.
    """
    try:
        import yfinance as yf
    except ImportError:
        logger.debug("yfinance not installed, skipping fast path")
        return []

    yf_symbol = f"{symbol}.TW" if market == "TWSE" else f"{symbol}.TWO"
    try:
        # yfinance end date is exclusive, so add one day
        end_exclusive = end + timedelta(days=1)
        ticker = yf.Ticker(yf_symbol)
        df = ticker.history(start=start.isoformat(), end=end_exclusive.isoformat(), auto_adjust=False)
    except Exception as exc:
        logger.warning("Yahoo Finance fetch failed for %s: %s", yf_symbol, exc)
        return []

    if df.empty:
        logger.debug("Yahoo Finance returned no data for %s", yf_symbol)
        return []

    from collections import namedtuple

    Data = namedtuple("Data", ["date", "open", "high", "low", "close", "capacity", "change"])

    rows = []
    prev_close = None
    for idx, row in df.iterrows():
        # Handle timezone-aware datetime index
        row_date = idx.date() if hasattr(idx, "date") else idx

        open_p = row.get("Open")
        high_p = row.get("High")
        low_p = row.get("Low")
        close_p = row.get("Close")
        volume = row.get("Volume")

        # Skip rows with missing OHLC
        if None in (open_p, high_p, low_p, close_p):
            continue
        try:
            o_val = float(open_p)
            h_val = float(high_p)
            l_val = float(low_p)
            c_val = float(close_p)
        except Exception:
            continue
        if None in (o_val, h_val, l_val, c_val):
            continue

        change = None
        if prev_close is not None:
            try:
                change = round(c_val - prev_close, 2)
            except Exception:
                pass

        try:
            vol_int = int(volume) if volume == volume else 0  # NaN check
        except Exception:
            vol_int = 0

        rows.append(
            Data(
                date=row_date,
                open=o_val,
                high=h_val,
                low=l_val,
                close=c_val,
                capacity=vol_int,
                change=change,
            )
        )
        prev_close = c_val

    logger.info("Yahoo Finance returned %d rows for %s", len(rows), yf_symbol)
    return rows


def sync_historical_prices(
    db: Session,
    symbol: str,
    start: Optional[date] = None,
    end: Optional[date] = None,
) -> StockSyncResult:
    """Fetch and cache historical prices for a stock."""
    stock = db.query(Stock).filter(Stock.symbol == symbol).first()
    if not stock:
        raise ValueError(f"Stock {symbol} not found")

    today = _taipei_today()
    status = _get_or_create_sync_status(db, stock)
    if end is None:
        end = today
    if start is None:
        latest_price_date = (
            db.query(StockPrice.date)
            .filter(StockPrice.stock_id == stock.id)
            .order_by(StockPrice.date.desc())
            .limit(1)
            .scalar()
        )
        if latest_price_date:
            start = max(
                latest_price_date - timedelta(days=settings.stock_daily_sync_lookback_days),
                date(1900, 1, 1),
            )
        else:
            start = _parse_date(settings.stock_history_start_date, date(2010, 1, 1))
    if start > end:
        raise ValueError("Start date cannot be after end date")

    status.status = "running"
    status.last_attempt_at = datetime.now(timezone.utc)
    status.last_error = None
    db.commit()

    months = list(_iter_months(start, end))
    months_requested = len(months)

    insert_stmt = (
        postgresql_insert
        if db.get_bind().dialect.name == "postgresql"
        else sqlite_insert
    )

    try:
        t0 = time.perf_counter()

        # Fast path: Yahoo Finance fetches all history in one request
        all_rows = _fetch_historical_yfinance(symbol, stock.market, start, end)
        fetcher_used = "yfinance"

        if not all_rows:
            # Fallback: twstock month-by-month fetch
            code_info = twstock.codes.get(symbol)
            data_source = getattr(code_info, "data_source", "twse") if code_info else "twse"
            fetcher = TWSEFetcher() if data_source == "twse" else TPEXFetcher()
            fetcher_used = "twstock"

            all_rows = []
            if len(months) == 1:
                rows = _fetch_month_with_fetcher(fetcher, symbol, months[0][0], months[0][1])
                if rows:
                    all_rows.extend(rows)
            else:
                from concurrent.futures import ThreadPoolExecutor, as_completed

                with ThreadPoolExecutor(max_workers=settings.stock_sync_max_concurrent) as executor:
                    futures = {
                        executor.submit(_fetch_month_with_fetcher, fetcher, symbol, year, month): (year, month)
                        for year, month in months
                    }
                    for future in as_completed(futures):
                        rows = future.result()
                        if rows:
                            all_rows.extend(rows)

        t1 = time.perf_counter()

        seen_dates = set()
        upserted = 0
        skipped = 0
        values_batch = []

        for data in all_rows:
            data_date = data.date.date() if isinstance(data.date, datetime) else data.date
            if data_date < start or data_date > end:
                continue
            if data_date in seen_dates:
                skipped += 1
                continue
            seen_dates.add(data_date)

            open_price = _to_decimal(data.open)
            high_price = _to_decimal(data.high)
            low_price = _to_decimal(data.low)
            close_price = _to_decimal(data.close)
            if None in (open_price, high_price, low_price, close_price):
                skipped += 1
                continue

            values_batch.append(dict(
                stock_id=stock.id,
                date=data_date,
                open_price=open_price,
                high_price=high_price,
                low_price=low_price,
                close_price=close_price,
                volume=_to_int(data.capacity) or 0,
                change=_to_decimal(data.change),
            ))

        if values_batch:
            stmt = insert_stmt(StockPrice).values(values_batch)
            stmt = stmt.on_conflict_do_update(
                index_elements=["stock_id", "date"],
                set_={
                    "open_price": stmt.excluded.open_price,
                    "high_price": stmt.excluded.high_price,
                    "low_price": stmt.excluded.low_price,
                    "close_price": stmt.excluded.close_price,
                    "volume": stmt.excluded.volume,
                    "change": stmt.excluded.change,
                },
            )
            result = db.execute(stmt)
            upserted = result.rowcount or 0

        t2 = time.perf_counter()
        logger.info(
            "[%s] synced %d months → %d rows via %s (fetch %.2fs | db %.2fs | total %.2fs)",
            symbol,
            months_requested,
            upserted,
            fetcher_used,
            t1 - t0,
            t2 - t1,
            t2 - t0,
        )

        status.status = "success"
        status.synced_from = start if status.synced_from is None else min(status.synced_from, start)
        status.synced_to = end if status.synced_to is None else max(status.synced_to, end)
        status.last_success_at = datetime.now(timezone.utc)
        status.last_error = None
        status.records_upserted = upserted
        db.commit()
    except Exception as exc:
        # Re-query stock to avoid detached instance error after rollback
        stock = db.query(Stock).filter(Stock.symbol == symbol).first()
        if stock:
            status = _get_or_create_sync_status(db, stock)
            status.status = "failed"
            status.last_attempt_at = datetime.now(timezone.utc)
            status.last_error = str(exc)[:500]
            db.commit()
        raise

    return StockSyncResult(
        symbol=symbol,
        start=start,
        end=end,
        records_upserted=upserted,
        records_skipped=skipped,
        months_requested=months_requested,
    )


def sync_recent_prices_for_active_stocks(db: Session, lookback_days: Optional[int] = None) -> int:
    """Refresh recent history for all active stocks after market close (parallel)."""
    if lookback_days is None:
        lookback_days = settings.stock_daily_sync_lookback_days
    end = _taipei_today()
    start = end - timedelta(days=lookback_days)

    stocks = db.query(Stock).filter(Stock.is_active == True).all()
    total = 0

    from concurrent.futures import ThreadPoolExecutor, as_completed
    from app.database import SessionLocal

    def _sync_one(symbol: str) -> int:
        db_thread = SessionLocal()
        try:
            result = sync_historical_prices(db_thread, symbol, start=start, end=end)
            return result.records_upserted
        except Exception:
            return 0
        finally:
            db_thread.close()

    with ThreadPoolExecutor(max_workers=settings.stock_sync_max_concurrent) as executor:
        futures = {
            executor.submit(_sync_one, stock.symbol): stock.symbol
            for stock in stocks
        }
        for future in as_completed(futures):
            total += future.result()

    return total


# ─── Real-time Quote ──────────────────────────────────────

def get_realtime_quote(symbol: str) -> Optional[dict]:
    """Get real-time quote from twstock. Returns dict or None if failed."""
    _rate_limit()
    try:
        rt = twstock.realtime.get(symbol)
    except Exception:
        logger.warning("Real-time quote fetch failed for %s", symbol, exc_info=False)
        return None
    if not rt.get("success"):
        return None
    info = rt.get("info", {})
    realtime = rt.get("realtime", {})

    price = _to_decimal(realtime.get("latest_trade_price"))
    open_p = _to_decimal(realtime.get("open"))
    high_p = _to_decimal(realtime.get("high"))
    low_p = _to_decimal(realtime.get("low"))
    close_p = _to_decimal(realtime.get("latest_trade_price"))
    volume = _to_int(realtime.get("accumulate_trade_volume"))
    change = _to_decimal(realtime.get("price_change"))
    change_percent = _to_decimal(realtime.get("price_change_percent"))

    # Calculate change_percent if missing
    if change_percent is None and change is not None and open_p and open_p > 0:
        change_percent = (change / open_p * 100).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    if None in (price, open_p, high_p, low_p):
        return None

    return {
        "symbol": info.get("code", symbol),
        "name": info.get("name", ""),
        "price": price,
        "open": open_p,
        "high": high_p,
        "low": low_p,
        "close": close_p,
        "volume": volume or 0,
        "change": change,
        "change_percent": change_percent,
        "last_updated": datetime.now(timezone.utc),
    }


# ─── Async Wrappers ───────────────────────────────────────

async def async_get_realtime_quote(symbol: str) -> Optional[dict]:
    """Async wrapper for get_realtime_quote using thread pool."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, get_realtime_quote, symbol)


async def async_sync_stock_list(db: Session) -> int:
    """Async wrapper for sync_stock_list using thread pool."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, sync_stock_list, db)
