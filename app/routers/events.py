import asyncio
import json
from typing import List

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse

from app.services.stock_data import async_get_realtime_quote

router = APIRouter(prefix="/events", tags=["Events"])


async def _quote_stream(symbols: List[str], interval: float = 30.0):
    """Async generator that yields Server-Sent Events with real-time quotes."""
    try:
        while True:
            quotes = []
            for symbol in symbols:
                try:
                    quote = await async_get_realtime_quote(symbol)
                    if quote:
                        quotes.append(quote)
                except Exception:
                    # Skip individual symbol failures; keep the stream alive
                    continue

            payload = json.dumps({"quotes": quotes}, default=str)
            yield f"data: {payload}\n\n"

            await asyncio.sleep(interval)
    except asyncio.CancelledError:
        # Client disconnected; exit gracefully
        return


@router.get("/quotes")
async def stream_quotes(
    symbols: str = Query(..., description="Comma-separated stock symbols"),
    interval: float = Query(30.0, ge=5.0, le=300.0, description="Refresh interval in seconds"),
):
    """
    Stream real-time quotes via Server-Sent Events.

    Example:
        GET /api/v1/events/quotes?symbols=2330,2317
    """
    symbol_list = [s.strip() for s in symbols.split(",") if s.strip()]
    if not symbol_list:
        return StreamingResponse(
            iter([f'data: {{"error": "No symbols provided"}}\n\n']),
            media_type="text/event-stream",
        )

    return StreamingResponse(
        _quote_stream(symbol_list, interval),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
