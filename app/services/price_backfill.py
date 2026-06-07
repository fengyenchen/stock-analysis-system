"""Lazy, self-healing price-history backfill.

The daily scheduler only keeps a 10-day rolling window fresh, so a stock that
nobody has explicitly synced accumulates history at ~1 trading row/day. The AI
analysis / recommendation endpoints read up to 120 rows and degrade below 20,
so an un-synced stock yields an empty technical picture.

This service watches those read paths: when a stock has too few price rows it
triggers a bounded background backfill (fire-and-forget, deduplicated, with a
cooldown) so subsequent views are rich. It deliberately reaches back ~1 year of
calendar days — enough to fill the 120 trading-day window the recommender uses —
rather than the full 2010 history that the explicit user/CLI sync performs.
"""

import logging
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from time import monotonic

from app.database import SessionLocal
from app.models import Stock, StockPrice
from app.services.stock_data import _taipei_today, sync_historical_prices

logger = logging.getLogger(__name__)

# Aim above the 20-bar degrade threshold so ma60 / the 120-row window populate.
MIN_PRICE_ROWS = 60
# Calendar-day reach of the lazy backfill (~250 trading days > the 120 window).
BACKFILL_DAYS = 400
# Don't re-attempt the same symbol more often than this.
_RETRY_COOLDOWN_SECONDS = 6 * 3600


class PriceBackfillService:
    def __init__(self, max_workers: int = 2) -> None:
        self._lock = threading.Lock()
        self._executor: ThreadPoolExecutor | None = None
        self._max_workers = max_workers
        self._inflight: set[str] = set()
        self._last_attempt: dict[str, float] = {}

    def maybe_backfill(self, db, stock: Stock) -> None:
        """If the stock's price history is too thin, kick off a background
        backfill. Non-blocking; safe to call on every request."""
        symbol = stock.symbol
        now = monotonic()

        # Cheap short-circuits before paying for the COUNT query.
        with self._lock:
            if symbol in self._inflight:
                return
            last = self._last_attempt.get(symbol)
            if last is not None and now - last < _RETRY_COOLDOWN_SECONDS:
                return

        row_count = (
            db.query(StockPrice).filter(StockPrice.stock_id == stock.id).count()
        )
        if row_count >= MIN_PRICE_ROWS:
            return

        with self._lock:
            if symbol in self._inflight:
                return
            self._inflight.add(symbol)
            self._last_attempt[symbol] = now

        self._get_executor().submit(self._run, symbol, row_count)

    def shutdown(self) -> None:
        with self._lock:
            executor = self._executor
            self._executor = None
        if executor:
            executor.shutdown(wait=False, cancel_futures=True)

    def _get_executor(self) -> ThreadPoolExecutor:
        with self._lock:
            if self._executor is None:
                self._executor = ThreadPoolExecutor(
                    max_workers=self._max_workers,
                    thread_name_prefix="price-backfill",
                )
            return self._executor

    def _run(self, symbol: str, prior_rows: int) -> None:
        try:
            with SessionLocal() as db:
                start = _taipei_today() - timedelta(days=BACKFILL_DAYS)
                result = sync_historical_prices(db, symbol, start=start)
                logger.info(
                    "Lazy price backfill completed",
                    extra={
                        "event": "price_backfill.done",
                        "symbol": symbol,
                        "prior_rows": prior_rows,
                        "upserted": result.records_upserted,
                    },
                )
        except Exception:
            logger.warning(
                "Lazy price backfill failed",
                extra={"event": "price_backfill.failed", "symbol": symbol},
                exc_info=True,
            )
        finally:
            with self._lock:
                self._inflight.discard(symbol)


price_backfill_service = PriceBackfillService()
