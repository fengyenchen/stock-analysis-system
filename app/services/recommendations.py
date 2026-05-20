from decimal import ROUND_HALF_UP, Decimal
from math import sqrt
from typing import Sequence

from sqlalchemy.orm import Session

from app.models import Stock, StockPrice
from app.schemas import (
    IndicatorSignal,
    RecommendationIndicators,
    RiskMetrics,
    StockRecommendationRead,
    SupportResistanceLevels,
)

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


def _avg_volume(prices: Sequence[StockPrice], window: int = 20) -> Decimal | None:
    if len(prices) < window:
        return None
    volumes = [Decimal(p.volume) for p in prices[-window:]]
    return _round_decimal(sum(volumes) / Decimal(window))


def _macd(closes: Sequence[Decimal], fast: int = 12, slow: int = 26, signal: int = 9) -> tuple[Decimal | None, Decimal | None, Decimal | None]:
    if len(closes) < slow:
        return None, None, None

    def _ema(values: Sequence[Decimal], period: int) -> list[Decimal]:
        multiplier = Decimal("2") / Decimal(period + 1)
        ema_values = [sum(values[:period]) / Decimal(period)]
        for i in range(period, len(values)):
            ema_values.append((values[i] - ema_values[-1]) * multiplier + ema_values[-1])
        return ema_values

    ema_fast = _ema(closes, fast)
    ema_slow = _ema(closes, slow)

    dif_values = [f - s for f, s in zip(ema_fast[-(len(ema_slow)):], ema_slow)]
    macd_signal_values = _ema(dif_values, signal)

    dif = _round_decimal(dif_values[-1])
    sig = _round_decimal(macd_signal_values[-1])
    histogram = _round_decimal(dif - sig)
    return dif, sig, histogram


def _bollinger_bands(closes: Sequence[Decimal], period: int = 20, std_dev: int = 2) -> tuple[Decimal | None, Decimal | None, Decimal | None]:
    if len(closes) < period:
        return None, None, None

    recent = closes[-period:]
    middle = sum(recent) / Decimal(period)
    variance = sum((c - middle) ** 2 for c in recent) / Decimal(period)
    std = Decimal(str(sqrt(float(variance))))
    upper = _round_decimal(middle + Decimal(std_dev) * std)
    lower = _round_decimal(middle - Decimal(std_dev) * std)
    return upper, _round_decimal(middle), lower


def _kd(highs: Sequence[Decimal], lows: Sequence[Decimal], closes: Sequence[Decimal], n: int = 9) -> tuple[Decimal | None, Decimal | None]:
    if len(closes) < n:
        return None, None

    highest_high = max(highs[-n:])
    lowest_low = min(lows[-n:])
    range_val = highest_high - lowest_low
    if range_val == 0:
        return Decimal("50.00"), Decimal("50.00")

    rsv = (closes[-1] - lowest_low) / range_val * Decimal("100")
    k = _round_decimal(rsv)
    d = _round_decimal(rsv)
    return k, d


def _atr(prices: Sequence[StockPrice], period: int = 14) -> Decimal | None:
    if len(prices) < period + 1:
        return None

    tr_values = []
    for i in range(1, len(prices)):
        high = Decimal(prices[i].high_price)
        low = Decimal(prices[i].low_price)
        prev_close = Decimal(prices[i - 1].close_price)
        tr1 = high - low
        tr2 = abs(high - prev_close)
        tr3 = abs(low - prev_close)
        tr_values.append(max(tr1, tr2, tr3))

    recent_tr = tr_values[-period:]
    return _round_decimal(sum(recent_tr) / Decimal(period))


def _volatility(closes: Sequence[Decimal], period: int = 20) -> Decimal | None:
    if len(closes) < period + 1:
        return None

    returns = [(closes[i] - closes[i - 1]) / closes[i - 1] for i in range(1, len(closes))]
    recent_returns = returns[-period:]
    avg_return = sum(recent_returns) / Decimal(period)
    variance = sum((r - avg_return) ** 2 for r in recent_returns) / Decimal(period)
    std = Decimal(str(sqrt(float(variance))))
    annualized = std * Decimal(str(sqrt(252))) * Decimal("100")
    return _round_decimal(annualized)


def _support_resistance(prices: Sequence[StockPrice]) -> tuple[Decimal | None, Decimal | None, Decimal | None, Decimal | None]:
    if len(prices) < 20:
        return None, None, None, None

    recent_20 = prices[-20:]
    recent_10 = prices[-10:]
    highs_20 = [Decimal(p.high_price) for p in recent_20]
    lows_20 = [Decimal(p.low_price) for p in recent_20]
    highs_10 = [Decimal(p.high_price) for p in recent_10]
    lows_10 = [Decimal(p.low_price) for p in recent_10]

    r2 = max(highs_20)
    r1 = max(highs_10)
    s1 = min(lows_10)
    s2 = min(lows_20)
    return r2, r1, s1, s2


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
    highs = [Decimal(price.high_price) for price in ordered_prices]
    lows = [Decimal(price.low_price) for price in ordered_prices]
    latest = ordered_prices[-1]
    latest_close = _round_decimal(closes[-1])
    ma5 = _moving_average(closes, 5)
    ma20 = _moving_average(closes, 20)
    ma60 = _moving_average(closes, 60)
    rsi14 = _rsi(closes, 14)
    volume_ratio = _volume_ratio(ordered_prices, 20)
    avg_volume = _avg_volume(ordered_prices, 20)
    macd_dif, macd_signal, macd_histogram = _macd(closes)
    bb_upper, bb_middle, bb_lower = _bollinger_bands(closes)
    kd_k, kd_d = _kd(highs, lows, closes)
    atr14 = _atr(ordered_prices)
    volatility_20d = _volatility(closes)
    r2, r1, s1, s2 = _support_resistance(ordered_prices)

    indicators = RecommendationIndicators(
        close=latest_close,
        ma5=ma5,
        ma20=ma20,
        ma60=ma60,
        rsi14=rsi14,
        volume_ratio=volume_ratio,
        avg_volume_20d=avg_volume,
        macd_dif=macd_dif,
        macd_signal=macd_signal,
        macd_histogram=macd_histogram,
        bollinger_upper=bb_upper,
        bollinger_middle=bb_middle,
        bollinger_lower=bb_lower,
        kd_k=kd_k,
        kd_d=kd_d,
        atr14=atr14,
        volatility_20d=volatility_20d,
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

    if macd_dif is not None and macd_signal is not None:
        if macd_dif > macd_signal:
            score += 1
            reasons.append("MACD DIF is above the signal line")
        elif macd_dif < macd_signal:
            score -= 1
            reasons.append("MACD DIF is below the signal line")
        else:
            reasons.append("MACD DIF and signal line are aligned")

    if kd_k is not None and kd_d is not None:
        if kd_k > kd_d and kd_k < Decimal("80"):
            score += 1
            reasons.append("KD K-line is above D-line, momentum is positive")
        elif kd_k < kd_d and kd_k > Decimal("20"):
            score -= 1
            reasons.append("KD K-line is below D-line, momentum is negative")
        else:
            reasons.append("KD is in extreme zone, be cautious")

    if bb_upper is not None and bb_lower is not None:
        if latest_close > bb_upper:
            score -= 1
            reasons.append("Price is above upper Bollinger Band, may be overbought")
        elif latest_close < bb_lower:
            score += 1
            reasons.append("Price is below lower Bollinger Band, may be oversold")
        else:
            reasons.append("Price is within Bollinger Bands, trending normally")

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

    composite_score = max(1, min(5, round(confidence / 20)))

    # Per-indicator signals
    ma_signal: str = "buy" if ma5 and ma20 and ma5 > ma20 else "sell" if ma5 and ma20 and ma5 < ma20 else "hold"
    rsi_signal: str = "buy" if rsi14 and rsi14 < Decimal("30") else "sell" if rsi14 and rsi14 > Decimal("70") else "hold"
    macd_signal_str: str = "buy" if macd_dif and macd_signal and macd_dif > macd_signal else "sell" if macd_dif and macd_signal and macd_dif < macd_signal else "hold"
    volume_signal: str = "buy" if volume_ratio and volume_ratio >= Decimal("1.10") else "hold"
    bollinger_signal: str = "buy" if latest_close and bb_lower and latest_close < bb_lower else "sell" if latest_close and bb_upper and latest_close > bb_upper else "hold"
    kd_signal: str = "buy" if kd_k and kd_d and kd_k > kd_d and kd_k < Decimal("80") else "sell" if kd_k and kd_d and kd_k < kd_d and kd_k > Decimal("20") else "hold"

    # Risk metrics
    risk_level = "low" if volatility_20d and volatility_20d < Decimal("15") else "high" if volatility_20d and volatility_20d > Decimal("30") else "medium"
    volatility_risk = min(100, max(0, int((volatility_20d or Decimal("20")) * 2)))
    liquidity_risk = min(100, max(0, 100 - int((avg_volume or Decimal("0")) / Decimal("100000"))))
    systemic_risk = 65 if risk_level == "high" else 45 if risk_level == "medium" else 25

    # Support / resistance + target / stop loss
    target_price = _round_decimal(latest_close + (atr14 or Decimal("0")) * Decimal("2")) if atr14 else None
    stop_loss = _round_decimal(latest_close - (atr14 or Decimal("0")) * Decimal("1.5")) if atr14 else None
    potential_return = _round_decimal((target_price - latest_close) / latest_close * Decimal("100")) if target_price else None

    return StockRecommendationRead(
        symbol=symbol,
        recommendation=recommendation,
        confidence=confidence,
        as_of=latest.date,
        indicators=indicators,
        reasons=reasons,
        disclaimer=DISCLAIMER,
        indicator_signals=IndicatorSignal(
            ma=ma_signal,
            rsi=rsi_signal,
            macd=macd_signal_str,
            volume=volume_signal,
            bollinger=bollinger_signal,
            kd=kd_signal,
        ),
        composite_score=composite_score,
        risk_metrics=RiskMetrics(
            risk_level=risk_level,
            volatility_risk=volatility_risk,
            liquidity_risk=liquidity_risk,
            fx_risk=10,
            systemic_risk=systemic_risk,
        ),
        support_resistance=SupportResistanceLevels(
            r2=r2,
            r1=r1,
            s1=s1,
            s2=s2,
            stop_loss=stop_loss,
            target_price=target_price,
            potential_return=potential_return,
        ),
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
