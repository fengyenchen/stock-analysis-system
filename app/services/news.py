"""Best-effort recent-news lookup for AI analysis context.

Sourced from yfinance (already a project dependency). Yahoo's coverage for
Taiwan tickers is sparse, so this is strictly best-effort: it never raises and
returns an empty list when nothing is available. Results are cached per symbol
in-process for an hour to avoid repeated yfinance round-trips, since AI analysis
requests are already rate-limited and deduplicated by symbol.
"""

import logging
from datetime import datetime, timezone
from threading import Lock
from time import monotonic
from typing import Optional

from app.models import Stock

logger = logging.getLogger(__name__)

_NEWS_TTL_SECONDS = 3600
_cache: dict[str, tuple[float, list[dict]]] = {}
_cache_lock = Lock()


def _parse_item(item: dict) -> Optional[dict]:
    """Normalize a single yfinance news entry.

    yfinance changed its news shape across versions: newer releases nest the
    fields under a ``content`` key, older ones keep them flat. Handle both.
    """
    if not isinstance(item, dict):
        return None

    content = item.get("content")
    if isinstance(content, dict):  # newer yfinance (>= ~0.2.4x)
        title = content.get("title")
        summary = content.get("summary") or content.get("description")
        published_at = content.get("pubDate") or content.get("displayTime")
        provider = content.get("provider") or {}
        publisher = provider.get("displayName") if isinstance(provider, dict) else None
    else:  # legacy flat shape
        title = item.get("title")
        summary = item.get("summary")
        ts = item.get("providerPublishTime")
        published_at = (
            datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()
            if isinstance(ts, (int, float))
            else None
        )
        publisher = item.get("publisher")

    if not title:
        return None
    return {
        "title": title,
        "summary": summary,
        "published_at": published_at,
        "publisher": publisher,
    }


def get_recent_news(stock: Stock, *, limit: int = 5) -> list[dict]:
    """Return up to ``limit`` recent headlines for the stock, or [] on any failure."""
    now = monotonic()
    with _cache_lock:
        cached = _cache.get(stock.symbol)
        if cached and now - cached[0] < _NEWS_TTL_SECONDS:
            return cached[1]

    try:
        import yfinance as yf
    except ImportError:
        return []

    suffix = ".TW" if stock.market == "TWSE" else ".TWO"
    try:
        raw = yf.Ticker(f"{stock.symbol}{suffix}").news or []
    except Exception:
        # Transient failure: do not cache, so the next request retries.
        logger.warning(
            "AI analysis news fetch failed",
            extra={"event": "ai_analysis.news_failure", "symbol": stock.symbol},
        )
        return []

    items: list[dict] = []
    for entry in raw:
        parsed = _parse_item(entry)
        if parsed:
            items.append(parsed)
        if len(items) >= limit:
            break

    with _cache_lock:
        _cache[stock.symbol] = (now, items)
    return items
