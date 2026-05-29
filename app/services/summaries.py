import json
import logging
import uuid
from decimal import Decimal
from typing import List

from fastapi.encoders import jsonable_encoder
from openai import OpenAI
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Stock, StockPrice
from app.schemas import AIAnalysisResponse, StockSummaryRead
from app.services.recommendations import get_stock_recommendation

logger = logging.getLogger(__name__)

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


def generate_deepseek_analysis(
    stock_code: str,
    company_name: str,
    context_data: dict,
    timeout_seconds: float | None = None,
) -> AIAnalysisResponse | None:
    if not settings.DEEPSEEK_API_KEY:
        logger.warning("DeepSeek API key is not configured")
        return None

    req_id = str(uuid.uuid4())

    system_prompt = """
    You are a professional quantitative and qualitative stock market analyst.
    You must output your analysis STRICTLY IN ENGLISH.
    You must ONLY output the result in the following JSON format. Do not include any Markdown tags (like ```json) or extra text:
    {
      "request_id": "the provided request_id",
      "action": 1,
      "summary": { "short_sentence": "...", "long_sentence": "..." },
      "reasons": { "technical": "...", "fundamental": "...", "comprehensive": "..." }
    }
    """

    try:
        context_str = json.dumps(jsonable_encoder(context_data), indent=2)
        user_prompt = f"""
        Request ID: {req_id}
        Please analyze the stock: [{stock_code} {company_name}].
        Here is the system-calculated data and recent news context:
        {context_str}

        Remember: Respond purely in JSON format, in English, and keep each reason under 50 words.
        """

        client = OpenAI(
            api_key=settings.DEEPSEEK_API_KEY,
            base_url="https://api.deepseek.com",
            timeout=timeout_seconds if timeout_seconds is not None else settings.ai_analysis_provider_timeout_seconds,
            max_retries=0,
        )
        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.3,
            max_tokens=800
        )

        raw_output = response.choices[0].message.content if response.choices else None
        if not raw_output:
            return None
        raw_output = raw_output.strip()

        if raw_output.startswith("```"):
            raw_output = raw_output.strip("`").removeprefix("json").strip()

        result_dict = json.loads(raw_output)
        result = AIAnalysisResponse(**result_dict)
        if result.request_id != req_id:
            logger.warning("DeepSeek response request_id mismatch")
            return None
        return result

    except Exception as e:
        logger.warning("DeepSeek analysis generation failed: %s", e)
        return None
