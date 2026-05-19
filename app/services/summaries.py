from decimal import Decimal
from typing import List

from sqlalchemy.orm import Session

from app.models import Stock, StockPrice
from app.schemas import StockSummaryRead
from app.services.recommendations import get_stock_recommendation


def get_stock_summaries(db: Session, symbols: List[str]) -> List[StockSummaryRead]:
    """Return enriched summaries for a batch of stock symbols.

    Reads the latest cached price and computes recommendations from historical
    data already stored in the database. Does not hit external real-time APIs.
    """
    stocks = (
        db.query(Stock)
        .filter(Stock.symbol.in_(symbols), Stock.is_active == True)
        .all()
    )

    stock_map = {s.symbol: s for s in stocks}
    result: List[StockSummaryRead] = []

    for symbol in symbols:
        stock = stock_map.get(symbol)
        if not stock:
            continue

        # Latest price (most recent date)
        latest_price = (
            db.query(StockPrice)
            .filter(StockPrice.stock_id == stock.id)
            .order_by(StockPrice.date.desc())
            .first()
        )

        # Sparkline: last 20 closes
        sparkline_rows = (
            db.query(StockPrice)
            .filter(StockPrice.stock_id == stock.id)
            .order_by(StockPrice.date.desc())
            .limit(20)
            .all()
        )
        sparkline_data = [
            Decimal(str(r.close_price)) for r in reversed(sparkline_rows)
        ]

        # Recommendation from cached data
        try:
            rec = get_stock_recommendation(db, stock)
            recommendation = rec.recommendation
            confidence = rec.confidence
            composite_score = rec.composite_score
        except Exception:
            recommendation = None
            confidence = None
            composite_score = None

        result.append(
            StockSummaryRead(
                symbol=stock.symbol,
                name=stock.name,
                market=stock.market,
                industry=stock.industry,
                is_etf=stock.is_etf,
                price=Decimal(str(latest_price.close_price)) if latest_price else None,
                change=Decimal(str(latest_price.change)) if latest_price and latest_price.change is not None else None,
                change_percent=Decimal(str(latest_price.change_percent)) if latest_price and latest_price.change_percent is not None else None,
                recommendation=recommendation,
                confidence=confidence,
                composite_score=composite_score,
                sparkline_data=sparkline_data,
            )
        )

    return result
