import json
from decimal import Decimal
from types import SimpleNamespace

from fastapi import status

from app.schemas import AIAnalysisResponse
from app.services import summaries


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
    class FakeCompletions:
        def create(self, **kwargs):
            raise RuntimeError("provider unavailable")

    class FakeOpenAI:
        def __init__(self, **kwargs):
            self.chat = SimpleNamespace(completions=FakeCompletions())

    monkeypatch.setattr(summaries, "OpenAI", FakeOpenAI)


def test_ai_analysis_requires_auth(client, sample_stocks):
    response = client.get("/api/v1/stocks/2330/ai-analysis")

    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_ai_analysis_stock_not_found(auth_client):
    response = auth_client.get("/api/v1/stocks/9999/ai-analysis")

    assert response.status_code == status.HTTP_404_NOT_FOUND


def test_ai_analysis_missing_api_key_returns_503(auth_client, sample_stocks, monkeypatch):
    monkeypatch.setattr(summaries.settings, "DEEPSEEK_API_KEY", None)
    monkeypatch.setattr("app.routers.stocks.get_stock_fundamentals", lambda *args: None)

    response = auth_client.get("/api/v1/stocks/2330/ai-analysis")

    assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE


def test_ai_analysis_success(auth_client, sample_stocks, monkeypatch):
    result = AIAnalysisResponse.model_validate(
        json.loads(_valid_ai_response("route-request-id"))
    )
    monkeypatch.setattr("app.routers.stocks.get_stock_fundamentals", lambda *args: None)
    monkeypatch.setattr(
        "app.routers.stocks.generate_deepseek_analysis",
        lambda **kwargs: result,
    )

    response = auth_client.get("/api/v1/stocks/2330/ai-analysis")

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["request_id"] == "route-request-id"
    assert response.json()["action"] == 1


def test_generate_deepseek_analysis_serializes_decimal_context(monkeypatch):
    captured = {}
    request_id = "decimal-request-id"
    monkeypatch.setattr(summaries.settings, "DEEPSEEK_API_KEY", "test-key")
    monkeypatch.setattr(summaries.uuid, "uuid4", lambda: request_id)
    _patch_deepseek_client(monkeypatch, _valid_ai_response(request_id), captured)

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


def test_generate_deepseek_analysis_invalid_json_returns_none(monkeypatch):
    captured = {}
    request_id = "invalid-json-request-id"
    monkeypatch.setattr(summaries.settings, "DEEPSEEK_API_KEY", "test-key")
    monkeypatch.setattr(summaries.uuid, "uuid4", lambda: request_id)
    _patch_deepseek_client(monkeypatch, "not json", captured)

    result = summaries.generate_deepseek_analysis("2330", "TSMC", {})

    assert result is None


def test_generate_deepseek_analysis_provider_failure_returns_none(monkeypatch):
    monkeypatch.setattr(summaries.settings, "DEEPSEEK_API_KEY", "test-key")
    _patch_failing_deepseek_client(monkeypatch)

    result = summaries.generate_deepseek_analysis("2330", "TSMC", {})

    assert result is None


def test_generate_deepseek_analysis_invalid_action_returns_none(monkeypatch):
    captured = {}
    request_id = "invalid-action-request-id"
    monkeypatch.setattr(summaries.settings, "DEEPSEEK_API_KEY", "test-key")
    monkeypatch.setattr(summaries.uuid, "uuid4", lambda: request_id)
    _patch_deepseek_client(monkeypatch, _valid_ai_response(request_id, action=2), captured)

    result = summaries.generate_deepseek_analysis("2330", "TSMC", {})

    assert result is None


def test_generate_deepseek_analysis_request_id_mismatch_returns_none(monkeypatch):
    captured = {}
    monkeypatch.setattr(summaries.settings, "DEEPSEEK_API_KEY", "test-key")
    monkeypatch.setattr(summaries.uuid, "uuid4", lambda: "expected-request-id")
    _patch_deepseek_client(
        monkeypatch,
        _valid_ai_response("provider-request-id"),
        captured,
    )

    result = summaries.generate_deepseek_analysis("2330", "TSMC", {})

    assert result is None
