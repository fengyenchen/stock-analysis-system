from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy.orm import Session

from app.models import Stock, StockFundamental


def _safe_decimal(value) -> Optional[Decimal]:
    if value is None:
        return None
    try:
        return Decimal(str(value))
    except (ValueError, TypeError):
        return None


def get_stock_fundamentals(db: Session, stock: Stock) -> Optional[StockFundamental]:
    """Fetch or refresh stock fundamentals from yfinance."""
    existing = db.query(StockFundamental).filter(StockFundamental.stock_id == stock.id).first()

    # Return cached if updated within 24 hours
    if existing and existing.updated_at:
        age = datetime.now(timezone.utc) - existing.updated_at
        if age.total_seconds() < 86400:
            return existing

    try:
        import yfinance as yf
    except ImportError:
        return existing

    suffix = ".TW" if stock.market == "TWSE" else ".TWO"
    ticker = yf.Ticker(f"{stock.symbol}{suffix}")
    info = ticker.info or {}

    if not info:
        return existing

    data = {
        "market_cap": _safe_decimal(info.get("marketCap")),
        "pe_ratio": _safe_decimal(info.get("trailingPE")),
        "dividend_yield": _safe_decimal(info.get("dividendYield")),
        "eps": _safe_decimal(info.get("trailingEps")),
        "book_value": _safe_decimal(info.get("bookValue")),
        "shares_outstanding": _safe_decimal(info.get("sharesOutstanding")),
        "fifty_two_week_high": _safe_decimal(info.get("fiftyTwoWeekHigh")),
        "fifty_two_week_low": _safe_decimal(info.get("fiftyTwoWeekLow")),
        "sector": info.get("sector") or info.get("industry"),
        "website": info.get("website"),
        "long_business_summary": info.get("longBusinessSummary"),
    }

    if existing:
        for key, value in data.items():
            setattr(existing, key, value)
        existing.updated_at = datetime.now(timezone.utc)
    else:
        existing = StockFundamental(stock_id=stock.id, **data)
        db.add(existing)

    db.commit()
    db.refresh(existing)
    return existing
