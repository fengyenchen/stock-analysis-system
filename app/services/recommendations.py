from decimal import Decimal, ROUND_HALF_UP
from typing import Sequence

from sqlalchemy.orm import Session

from app.models import Stock, StockPrice
from app.schemas import RecommendationIndicators, StockRecommendationRead


DISCLAIMER = (
    "This is a technical signal generated from historical price data and is not financial advice."
)


def _round_decimal(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _average(values: Sequence[Decimal]) -> Decimal:
    return _round_decimal(sum(values) / Decimal(len(values)))


def _moving_average(closes: Sequence[Decimal], window: int) -> Decimal | None:
    if len(closes) < window:
        return None
    return _average(closes[-window:])


def _rsi(closes: Sequence[Decimal], period: int = 14) -> Decimal | None:
    if len(closes) <= period:
        return None

    changes = [closes[i] - closes[i - 1] for i in range(1, len(closes))]
    recent_changes = changes[-period:]
    gains = [change for change in recent_changes if change > 0]
    losses = [-change for change in recent_changes if change < 0]

    average_gain = sum(gains, Decimal("0")) / Decimal(period)
    average_loss = sum(losses, Decimal("0")) / Decimal(period)

    if average_loss == 0:
        return Decimal("100.00") if average_gain > 0 else Decimal("50.00")

    relative_strength = average_gain / average_loss
    rsi = Decimal("100") - (Decimal("100") / (Decimal("1") + relative_strength))
    return _round_decimal(rsi)


def _volume_ratio(prices: Sequence[StockPrice], window: int = 20) -> Decimal | None:
    if len(prices) < window:
        return None

    recent_volumes = [Decimal(price.volume) for price in prices[-window:]]
    average_volume = sum(recent_volumes) / Decimal(window)
    if average_volume <= 0:
        return None

    return _round_decimal(Decimal(prices[-1].volume) / average_volume)


def build_stock_recommendation(symbol: str, prices: Sequence[StockPrice]) -> StockRecommendationRead:
    ordered_prices = sorted(prices, key=lambda price: price.date)
    if not ordered_prices:
        return StockRecommendationRead(
            symbol=symbol,
            recommendation="hold",
            confidence=20,
            as_of=None,
            indicators=RecommendationIndicators(close=Decimal("0.00")),
            reasons=["Not enough historical price data"],
            disclaimer=DISCLAIMER,
        )

    closes = [Decimal(price.close_price) for price in ordered_prices]
    latest = ordered_prices[-1]
    latest_close = _round_decimal(closes[-1])
    ma5 = _moving_average(closes, 5)
    ma20 = _moving_average(closes, 20)
    ma60 = _moving_average(closes, 60)
    rsi14 = _rsi(closes, 14)
    volume_ratio = _volume_ratio(ordered_prices, 20)

    indicators = RecommendationIndicators(
        close=latest_close,
        ma5=ma5,
        ma20=ma20,
        ma60=ma60,
        rsi14=rsi14,
        volume_ratio=volume_ratio,
    )

    if len(ordered_prices) < 20 or ma20 is None:
        return StockRecommendationRead(
            symbol=symbol,
            recommendation="hold",
            confidence=20,
            as_of=latest.date,
            indicators=indicators,
            reasons=["Not enough historical price data"],
            disclaimer=DISCLAIMER,
        )

    score = 0
    reasons: list[str] = []

    if latest_close > ma20:
        score += 2
        reasons.append("Price is above the 20-day moving average")
    else:
        score -= 2
        reasons.append("Price is below the 20-day moving average")

    if ma5 is not None:
        if ma5 > ma20:
            score += 1
            reasons.append("5-day moving average is above the 20-day moving average")
        else:
            score -= 1
            reasons.append("5-day moving average is below the 20-day moving average")

    if ma60 is not None:
        if ma20 > ma60:
            score += 1
            reasons.append("20-day moving average is above the 60-day moving average")
        else:
            score -= 1
            reasons.append("20-day moving average is below the 60-day moving average")

    if rsi14 is not None:
        if Decimal("45") <= rsi14 <= Decimal("70"):
            score += 1
            reasons.append("RSI is in a healthy momentum range")
        elif rsi14 > Decimal("75"):
            score -= 1
            reasons.append("RSI indicates the stock may be overbought")
        elif rsi14 < Decimal("30"):
            score -= 1
            reasons.append("RSI indicates weak recent momentum")
        else:
            reasons.append("RSI is neutral")

    if len(closes) >= 2 and volume_ratio is not None:
        if latest_close > closes[-2] and volume_ratio >= Decimal("1.10"):
            score += 1
            reasons.append("Price rose on above-average volume")
        elif latest_close < closes[-2] and volume_ratio >= Decimal("1.10"):
            score -= 1
            reasons.append("Price fell on above-average volume")
        else:
            reasons.append("Volume does not strongly confirm the latest move")

    if score >= 3:
        recommendation = "buy"
    elif score <= -2:
        recommendation = "sell"
    else:
        recommendation = "hold"

    confidence = 40 + min(abs(score), 5) * 10
    if len(ordered_prices) < 60:
        confidence -= 10
    confidence = max(20, min(confidence, 90))

    return StockRecommendationRead(
        symbol=symbol,
        recommendation=recommendation,
        confidence=confidence,
        as_of=latest.date,
        indicators=indicators,
        reasons=reasons,
        disclaimer=DISCLAIMER,
    )


def get_stock_recommendation(db: Session, stock: Stock) -> StockRecommendationRead:
    prices = (
        db.query(StockPrice)
        .filter(StockPrice.stock_id == stock.id)
        .order_by(StockPrice.date.desc())
        .limit(120)
        .all()
    )
    return build_stock_recommendation(stock.symbol, prices)
