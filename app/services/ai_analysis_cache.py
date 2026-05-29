import threading
import time
from dataclasses import dataclass

from app.schemas import AIAnalysisResponse


@dataclass
class _CacheEntry:
    response: AIAnalysisResponse
    expires_at: float


class AIAnalysisCache:
    def __init__(self, clock=time.monotonic):
        self._clock = clock
        self._entries: dict[str, _CacheEntry] = {}
        self._lock = threading.Lock()

    def get(self, symbol: str) -> AIAnalysisResponse | None:
        key = self._normalize_key(symbol)
        now = self._clock()

        with self._lock:
            entry = self._entries.get(key)
            if entry is None:
                return None
            if entry.expires_at <= now:
                self._entries.pop(key, None)
                return None
            return entry.response.model_copy(deep=True)

    def set(self, symbol: str, response: AIAnalysisResponse, ttl_seconds: int) -> None:
        if ttl_seconds <= 0:
            return

        key = self._normalize_key(symbol)
        expires_at = self._clock() + ttl_seconds

        with self._lock:
            self._entries[key] = _CacheEntry(
                response=response.model_copy(deep=True),
                expires_at=expires_at,
            )

    def clear(self) -> None:
        with self._lock:
            self._entries.clear()

    @staticmethod
    def _normalize_key(symbol: str) -> str:
        return symbol.strip().upper()


ai_analysis_cache = AIAnalysisCache()
