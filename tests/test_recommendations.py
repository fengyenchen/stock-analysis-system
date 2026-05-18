from datetime import date, timedelta
from decimal import Decimal

from app.models import StockPrice
from app.services.recommendations import build_stock_recommendation


def _prices(closes, *, start=date(2024, 1, 1), volume=100_000):
    rows = []
    for index, close in enumerate(closes):
        close_decimal = Decimal(str(close))
        rows.append(
            StockPrice(
                stock_id=1,
                date=start + timedelta(days=index),
                open_price=close_decimal,
                high_price=close_decimal,
                low_price=close_decimal,
                close_price=close_decimal,
                volume=volume,
            )
        )
    return rows


class TestBuildStockRecommendation:
    def test_no_prices_returns_low_confidence_hold(self):
        result = build_stock_recommendation("2330", [])

        assert result.recommendation == "hold"
        assert result.confidence == 20
        assert result.as_of is None
        assert "Not enough historical price data" in result.reasons

    def test_less_than_20_prices_returns_low_confidence_hold(self):
        result = build_stock_recommendation("2330", _prices(range(1, 11)))

        assert result.recommendation == "hold"
        assert result.confidence == 20
        assert result.as_of == date(2024, 1, 10)
        assert result.indicators.close == Decimal("10.00")

    def test_uptrend_returns_buy(self):
        closes = list(range(100, 180))
        result = build_stock_recommendation("2330", _prices(closes, volume=120_000))

        assert result.recommendation == "buy"
        assert result.confidence >= 70
        assert "Price is above the 20-day moving average" in result.reasons
        assert result.indicators.ma5 is not None
        assert result.indicators.ma20 is not None
        assert result.indicators.ma60 is not None

    def test_downtrend_returns_sell(self):
        closes = list(range(180, 100, -1))
        result = build_stock_recommendation("2330", _prices(closes, volume=120_000))

        assert result.recommendation == "sell"
        assert result.confidence >= 70
        assert "Price is below the 20-day moving average" in result.reasons

    def test_mixed_indicators_returns_hold(self):
        closes = list(range(100, 140))
        result = build_stock_recommendation("2330", _prices(closes))

        assert result.recommendation == "hold"
        assert result.confidence >= 20
        assert result.disclaimer
