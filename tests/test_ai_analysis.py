import json
import logging
from datetime import datetime, timezone
from decimal import Decimal
from types import SimpleNamespace

from fastapi import status

from app.schemas import AIAnalysisResponse
from app.services import summaries
from app.services.ai_analysis_cache import AIAnalysisCache
from app.services.ai_analysis_jobs import AIAnalysisProviderUnavailable


def _records_for(caplog, event: str):
    return [record for record in caplog.records if getattr(record, "event", None) == event]


class _FakeClock:
    def __init__(self):
        self.now = 0.0

    def __call__(self):
        return self.now

    def advance(self, seconds: float):
        self.now += seconds


def _valid_ai_response(request_id: str, action: int = 1) -> str:
    return json.dumps(
        {
            "request_id": request_id,
            "action": action,
            "summary": {
                "short_sentence": "Momentum is improving.",
                "long_sentence": "The stock has improving technical and fundamental context.",
            },
            "reasons": {
                "technical": "The trend is constructive.",
                "fundamental": "Valuation remains reasonable.",
                "comprehensive": "Risk and reward are balanced.",
            },
        }
    )


def _ai_response(request_id: str) -> AIAnalysisResponse:
    return AIAnalysisResponse.model_validate(json.loads(_valid_ai_response(request_id)))


def _job(job_id: int, symbol: str = "2330", status_value: str = "pending") -> SimpleNamespace:
    now = datetime.now(timezone.utc)
    return SimpleNamespace(
        id=job_id,
        stock=SimpleNamespace(symbol=symbol),
        status=status_value,
        result_json=None,
        last_error=None,
        created_at=now,
        started_at=None,
        completed_at=None,
    )


def _patch_deepseek_client(monkeypatch, content: str, captured: dict):
    class FakeCompletions:
        def create(self, **kwargs):
            captured["request"] = kwargs
            return SimpleNamespace(
                choices=[
                    SimpleNamespace(
                        message=SimpleNamespace(content=content),
                    )
                ]
            )

    class FakeOpenAI:
        def __init__(self, **kwargs):
            captured["client"] = kwargs
            self.chat = SimpleNamespace(completions=FakeCompletions())

    monkeypatch.setattr(summaries, "OpenAI", FakeOpenAI)


def _patch_failing_deepseek_client(monkeypatch):
    _patch_raising_deepseek_client(monkeypatch, RuntimeError("provider unavailable"))


def _patch_raising_deepseek_client(monkeypatch, exc: Exception):
    class FakeCompletions:
        def create(self, **kwargs):
            raise exc

    class FakeOpenAI:
        def __init__(self, **kwargs):
            self.chat = SimpleNamespace(completions=FakeCompletions())

    monkeypatch.setattr(summaries, "OpenAI", FakeOpenAI)


def _provider_failure_record(caplog, failure_category: str):
    records = [
        record
        for record in _records_for(caplog, "ai_analysis.provider_failure")
        if getattr(record, "failure_category", None) == failure_category
    ]
    assert len(records) == 1
    record = records[0]
    assert record.symbol == "2330"
    assert record.provider == "deepseek"
    return record


def test_ai_analysis_cache_miss_enqueues_job(auth_client, sample_stocks, monkeypatch):
    clock = _FakeClock()
    cache = AIAnalysisCache(clock=clock)
    calls = []

    monkeypatch.setattr("app.routers.stocks.ai_analysis_cache", cache)
    monkeypatch.setattr("app.routers.stocks.settings.ai_analysis_cache_ttl_seconds", 300)
    monkeypatch.setattr("app.routers.stocks.settings.DEEPSEEK_API_KEY", "test-key")
    monkeypatch.setattr("app.routers.stocks.get_stock_fundamentals", lambda *args: None)

    class FakeJobService:
        def get_recent_success(self, *args):
            return None

        def get_active_job(self, *args):
            return None

        def has_recent_failure(self, *args):
            return False

        def enqueue(self, *args, **kwargs):
            calls.append(kwargs)
            return _job(123)

    monkeypatch.setattr("app.routers.stocks.ai_analysis_job_service", FakeJobService())

    response = auth_client.get("/api/v1/stocks/2330/ai-analysis")

    assert response.status_code == status.HTTP_202_ACCEPTED
    assert response.headers["location"] == "/api/v1/stocks/2330/ai-analysis"
    assert response.json()["id"] == 123
    assert response.json()["status"] == "pending"
    assert len(calls) == 1
    assert calls[0]["stock"].symbol == "2330"


def test_ai_analysis_logs_degraded_fundamentals_unavailable(
    auth_client,
    sample_stocks,
    monkeypatch,
    caplog,
):
    calls = []
    monkeypatch.setattr("app.routers.stocks.settings.DEEPSEEK_API_KEY", "test-key")
    monkeypatch.setattr("app.routers.stocks.get_stock_fundamentals", lambda *args: None)

    class FakeJobService:
        def get_recent_success(self, *args):
            return None

        def get_active_job(self, *args):
            return None

        def has_recent_failure(self, *args):
            return False

        def enqueue(self, *args, **kwargs):
            calls.append(kwargs)
            return _job(125)

    monkeypatch.setattr("app.routers.stocks.ai_analysis_job_service", FakeJobService())

    with caplog.at_level(logging.WARNING, logger="app.routers.stocks"):
        response = auth_client.get("/api/v1/stocks/2330/ai-analysis")

    assert response.status_code == status.HTTP_202_ACCEPTED
    assert len(calls) == 1
    records = _records_for(caplog, "ai_analysis.context_degraded")
    assert len(records) == 1
    assert records[0].symbol == "2330"
    assert records[0].failure_category == "fundamentals_unavailable"


def test_ai_analysis_logs_degraded_fundamentals_exception(
    auth_client,
    sample_stocks,
    monkeypatch,
    caplog,
):
    calls = []
    monkeypatch.setattr("app.routers.stocks.settings.DEEPSEEK_API_KEY", "test-key")

    def raise_fundamentals_error(*args):
        raise RuntimeError("fundamentals source unavailable")

    monkeypatch.setattr("app.routers.stocks.get_stock_fundamentals", raise_fundamentals_error)

    class FakeJobService:
        def get_recent_success(self, *args):
            return None

        def get_active_job(self, *args):
            return None

        def has_recent_failure(self, *args):
            return False

        def enqueue(self, *args, **kwargs):
            calls.append(kwargs)
            return _job(126)

    monkeypatch.setattr("app.routers.stocks.ai_analysis_job_service", FakeJobService())

    with caplog.at_level(logging.WARNING, logger="app.routers.stocks"):
        response = auth_client.get("/api/v1/stocks/2330/ai-analysis")

    assert response.status_code == status.HTTP_202_ACCEPTED
    assert len(calls) == 1
    records = _records_for(caplog, "ai_analysis.context_degraded")
    assert len(records) == 1
    assert records[0].symbol == "2330"
    assert records[0].failure_category == "fundamentals_exception"
    assert records[0].exception_type == "RuntimeError"


def test_ai_analysis_cache_hit_skips_job_service(auth_client, sample_stocks, monkeypatch):
    clock = _FakeClock()
    cache = AIAnalysisCache(clock=clock)
    cache.set("2330", _ai_response("cached-request-id"), ttl_seconds=300)

    monkeypatch.setattr("app.routers.stocks.ai_analysis_cache", cache)
    monkeypatch.setattr("app.routers.stocks.settings.DEEPSEEK_API_KEY", "test-key")

    class FakeJobService:
        def get_recent_success(self, *args):
            raise AssertionError("job service should not be called on cache hit")

    monkeypatch.setattr("app.routers.stocks.ai_analysis_job_service", FakeJobService())

    response = auth_client.get("/api/v1/stocks/2330/ai-analysis")

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["request_id"] == "cached-request-id"


def test_ai_analysis_cache_expires_after_ttl(auth_client, sample_stocks, monkeypatch):
    clock = _FakeClock()
    cache = AIAnalysisCache(clock=clock)
    calls = []

    monkeypatch.setattr("app.routers.stocks.ai_analysis_cache", cache)
    monkeypatch.setattr("app.routers.stocks.settings.ai_analysis_cache_ttl_seconds", 5)
    monkeypatch.setattr("app.routers.stocks.settings.DEEPSEEK_API_KEY", "test-key")
    monkeypatch.setattr("app.routers.stocks.get_stock_fundamentals", lambda *args: None)

    cache.set("2330", _ai_response("cached-request-id"), ttl_seconds=5)

    class FakeJobService:
        def get_recent_success(self, *args):
            return None

        def get_active_job(self, *args):
            return None

        def has_recent_failure(self, *args):
            return False

        def enqueue(self, *args, **kwargs):
            calls.append(kwargs)
            return _job(124)

    monkeypatch.setattr("app.routers.stocks.ai_analysis_job_service", FakeJobService())

    first_response = auth_client.get("/api/v1/stocks/2330/ai-analysis")
    clock.advance(5)
    second_response = auth_client.get("/api/v1/stocks/2330/ai-analysis")

    assert first_response.status_code == status.HTTP_200_OK
    assert second_response.status_code == status.HTTP_202_ACCEPTED
    assert first_response.json()["request_id"] == "cached-request-id"
    assert second_response.json()["id"] == 124
    assert len(calls) == 1


def test_ai_analysis_cache_disabled_by_zero_ttl(auth_client, sample_stocks, monkeypatch):
    clock = _FakeClock()
    cache = AIAnalysisCache(clock=clock)
    calls = []

    monkeypatch.setattr("app.routers.stocks.ai_analysis_cache", cache)
    monkeypatch.setattr("app.routers.stocks.settings.ai_analysis_cache_ttl_seconds", 0)
    monkeypatch.setattr("app.routers.stocks.settings.DEEPSEEK_API_KEY", "test-key")
    monkeypatch.setattr("app.routers.stocks.get_stock_fundamentals", lambda *args: None)

    class FakeJobService:
        def get_recent_success(self, *args):
            return None

        def get_active_job(self, *args):
            return None

        def has_recent_failure(self, *args):
            return False

        def enqueue(self, *args, **kwargs):
            calls.append(kwargs)
            return _job(200 + len(calls))

    monkeypatch.setattr("app.routers.stocks.ai_analysis_job_service", FakeJobService())

    first_response = auth_client.get("/api/v1/stocks/2330/ai-analysis")
    second_response = auth_client.get("/api/v1/stocks/2330/ai-analysis")

    assert first_response.status_code == status.HTTP_202_ACCEPTED
    assert second_response.status_code == status.HTTP_202_ACCEPTED
    assert first_response.json()["id"] == 201
    assert second_response.json()["id"] == 202
    assert len(calls) == 2


def test_ai_analysis_requires_auth(client, sample_stocks):
    response = client.get("/api/v1/stocks/2330/ai-analysis")

    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_ai_analysis_requires_auth_before_cache_lookup_or_provider(
    client,
    sample_stocks,
    monkeypatch,
):
    calls = {"cache": 0, "provider": 0}

    class FakeCache:
        def get(self, symbol):
            calls["cache"] += 1
            return None

        def set(self, symbol, response, ttl_seconds):
            pass

    class FakeJobService:
        def get_recent_success(self, *args):
            calls["provider"] += 1
            return _ai_response("provider-request-id")

    monkeypatch.setattr("app.routers.stocks.ai_analysis_cache", FakeCache())
    monkeypatch.setattr("app.routers.stocks.ai_analysis_job_service", FakeJobService())

    response = client.get("/api/v1/stocks/2330/ai-analysis")

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert calls == {"cache": 0, "provider": 0}


def test_ai_analysis_stock_not_found(auth_client):
    response = auth_client.get("/api/v1/stocks/9999/ai-analysis")

    assert response.status_code == status.HTTP_404_NOT_FOUND


def test_ai_analysis_missing_api_key_returns_503(auth_client, sample_stocks, monkeypatch, caplog):
    monkeypatch.setattr(summaries.settings, "DEEPSEEK_API_KEY", None)
    monkeypatch.setattr("app.routers.stocks.get_stock_fundamentals", lambda *args: None)

    with caplog.at_level(logging.WARNING, logger="app.routers.stocks"):
        response = auth_client.get("/api/v1/stocks/2330/ai-analysis")

    assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
    record = _provider_failure_record(caplog, "missing_api_key")
    assert not hasattr(record, "request_id")


def test_ai_analysis_recent_success_returns_200(auth_client, sample_stocks, monkeypatch):
    result = AIAnalysisResponse.model_validate(json.loads(_valid_ai_response("route-request-id")))
    monkeypatch.setattr("app.routers.stocks.get_stock_fundamentals", lambda *args: None)
    monkeypatch.setattr("app.routers.stocks.settings.DEEPSEEK_API_KEY", "test-key")

    class FakeJobService:
        def get_recent_success(self, *args):
            return result

    monkeypatch.setattr("app.routers.stocks.ai_analysis_job_service", FakeJobService())

    response = auth_client.get("/api/v1/stocks/2330/ai-analysis")

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["request_id"] == "route-request-id"
    assert response.json()["action"] == 1


def test_ai_analysis_active_job_returns_202(auth_client, sample_stocks, monkeypatch):
    monkeypatch.setattr("app.routers.stocks.settings.DEEPSEEK_API_KEY", "test-key")

    class FakeJobService:
        def get_recent_success(self, *args):
            return None

        def get_active_job(self, *args):
            return _job(321, status_value="running")

    monkeypatch.setattr("app.routers.stocks.ai_analysis_job_service", FakeJobService())

    response = auth_client.get("/api/v1/stocks/2330/ai-analysis")

    assert response.status_code == status.HTTP_202_ACCEPTED
    assert response.json()["id"] == 321
    assert response.json()["status"] == "running"


def test_ai_analysis_recent_failed_job_returns_503(auth_client, sample_stocks, monkeypatch):
    monkeypatch.setattr("app.routers.stocks.settings.DEEPSEEK_API_KEY", "test-key")

    class FakeJobService:
        def get_recent_success(self, *args):
            return None

        def get_active_job(self, *args):
            return None

        def has_recent_failure(self, *args):
            return True

    monkeypatch.setattr("app.routers.stocks.ai_analysis_job_service", FakeJobService())

    response = auth_client.get("/api/v1/stocks/2330/ai-analysis")

    assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE


def test_ai_analysis_queue_or_circuit_open_returns_503(auth_client, sample_stocks, monkeypatch):
    monkeypatch.setattr("app.routers.stocks.settings.DEEPSEEK_API_KEY", "test-key")
    monkeypatch.setattr("app.routers.stocks.get_stock_fundamentals", lambda *args: None)

    class FakeJobService:
        def get_recent_success(self, *args):
            return None

        def get_active_job(self, *args):
            return None

        def has_recent_failure(self, *args):
            return False

        def enqueue(self, *args, **kwargs):
            raise AIAnalysisProviderUnavailable("circuit open")

    monkeypatch.setattr("app.routers.stocks.ai_analysis_job_service", FakeJobService())

    response = auth_client.get("/api/v1/stocks/2330/ai-analysis")

    assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE


def test_generate_deepseek_analysis_serializes_decimal_context(monkeypatch, caplog):
    captured = {}
    request_id = "decimal-request-id"
    monkeypatch.setattr(summaries.settings, "DEEPSEEK_API_KEY", "test-key")
    monkeypatch.setattr(summaries.uuid, "uuid4", lambda: request_id)
    _patch_deepseek_client(monkeypatch, _valid_ai_response(request_id), captured)

    with caplog.at_level(logging.INFO, logger="app.services.summaries"):
        result = summaries.generate_deepseek_analysis(
            stock_code="2330",
            company_name="TSMC",
            context_data={
                "pe_ratio": Decimal("18.25"),
                "dividend_yield": Decimal("0.0215"),
                "market_cap": Decimal("123456789.12"),
            },
        )

    assert result is not None
    assert result.request_id == request_id
    assert captured["client"]["timeout"] == 20.0
    assert captured["client"]["max_retries"] == 0
    user_prompt = captured["request"]["messages"][1]["content"]
    assert "18.25" in user_prompt
    assert "123456789.12" in user_prompt
    success_records = _records_for(caplog, "ai_analysis.provider_success")
    assert len(success_records) == 1
    assert success_records[0].symbol == "2330"
    assert success_records[0].provider == "deepseek"
    assert success_records[0].request_id == request_id
    assert success_records[0].action == 1
    assert "test-key" not in success_records[0].getMessage()
    assert "18.25" not in success_records[0].getMessage()


def test_generate_deepseek_analysis_invalid_json_returns_none(monkeypatch, caplog):
    captured = {}
    request_id = "invalid-json-request-id"
    monkeypatch.setattr(summaries.settings, "DEEPSEEK_API_KEY", "test-key")
    monkeypatch.setattr(summaries.uuid, "uuid4", lambda: request_id)
    _patch_deepseek_client(monkeypatch, "not json", captured)

    with caplog.at_level(logging.WARNING, logger="app.services.summaries"):
        result = summaries.generate_deepseek_analysis("2330", "TSMC", {})

    assert result is None
    record = _provider_failure_record(caplog, "invalid_json")
    assert record.request_id == request_id
    assert record.exception_type == "JSONDecodeError"


def test_generate_deepseek_analysis_provider_failure_returns_none(monkeypatch, caplog):
    monkeypatch.setattr(summaries.settings, "DEEPSEEK_API_KEY", "test-key")
    _patch_failing_deepseek_client(monkeypatch)

    with caplog.at_level(logging.WARNING, logger="app.services.summaries"):
        result = summaries.generate_deepseek_analysis("2330", "TSMC", {})

    assert result is None
    record = _provider_failure_record(caplog, "provider_exception")
    assert record.exception_type == "RuntimeError"


def test_generate_deepseek_analysis_invalid_action_returns_none(monkeypatch, caplog):
    captured = {}
    request_id = "invalid-action-request-id"
    monkeypatch.setattr(summaries.settings, "DEEPSEEK_API_KEY", "test-key")
    monkeypatch.setattr(summaries.uuid, "uuid4", lambda: request_id)
    _patch_deepseek_client(monkeypatch, _valid_ai_response(request_id, action=2), captured)

    with caplog.at_level(logging.WARNING, logger="app.services.summaries"):
        result = summaries.generate_deepseek_analysis("2330", "TSMC", {})

    assert result is None
    record = _provider_failure_record(caplog, "invalid_action")
    assert record.request_id == request_id


def test_generate_deepseek_analysis_request_id_mismatch_returns_none(monkeypatch, caplog):
    captured = {}
    monkeypatch.setattr(summaries.settings, "DEEPSEEK_API_KEY", "test-key")
    monkeypatch.setattr(summaries.uuid, "uuid4", lambda: "expected-request-id")
    _patch_deepseek_client(
        monkeypatch,
        _valid_ai_response("provider-request-id"),
        captured,
    )

    with caplog.at_level(logging.WARNING, logger="app.services.summaries"):
        result = summaries.generate_deepseek_analysis("2330", "TSMC", {})

    assert result is None
    record = _provider_failure_record(caplog, "request_id_mismatch")
    assert record.request_id == "expected-request-id"


def test_generate_deepseek_analysis_empty_response_returns_none(monkeypatch, caplog):
    captured = {}
    request_id = "empty-response-request-id"
    monkeypatch.setattr(summaries.settings, "DEEPSEEK_API_KEY", "test-key")
    monkeypatch.setattr(summaries.uuid, "uuid4", lambda: request_id)
    _patch_deepseek_client(monkeypatch, "", captured)

    with caplog.at_level(logging.WARNING, logger="app.services.summaries"):
        result = summaries.generate_deepseek_analysis("2330", "TSMC", {})

    assert result is None
    record = _provider_failure_record(caplog, "empty_response")
    assert record.request_id == request_id


def test_generate_deepseek_analysis_timeout_returns_none(monkeypatch, caplog):
    class FakeTimeoutError(Exception):
        pass

    request_id = "timeout-request-id"
    monkeypatch.setattr(summaries.settings, "DEEPSEEK_API_KEY", "test-key")
    monkeypatch.setattr(summaries.uuid, "uuid4", lambda: request_id)
    monkeypatch.setattr(summaries, "APITimeoutError", FakeTimeoutError)
    _patch_raising_deepseek_client(monkeypatch, FakeTimeoutError("request timed out"))

    with caplog.at_level(logging.WARNING, logger="app.services.summaries"):
        result = summaries.generate_deepseek_analysis("2330", "TSMC", {})

    assert result is None
    record = _provider_failure_record(caplog, "timeout")
    assert record.request_id == request_id
    assert record.exception_type == "FakeTimeoutError"
