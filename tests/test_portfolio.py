from datetime import datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import patch

from fastapi import status

from app.models import PortfolioTransaction

BASE_DATE = datetime(2026, 1, 1, tzinfo=timezone.utc)


def _transaction_payload(
    transaction_type: str,
    shares: str,
    price: str,
    *,
    symbol: str = "2330",
    days: int = 0,
) -> dict[str, str]:
    return {
        "symbol": symbol,
        "transaction_type": transaction_type,
        "shares": shares,
        "price": price,
        "transaction_date": (BASE_DATE + timedelta(days=days)).isoformat(),
    }


def _decimal(value) -> Decimal:
    return Decimal(str(value))


class TestPortfolioCostBasis:
    @patch("app.routers.portfolio.async_get_realtime_quote")
    def test_partial_sell_uses_held_average_cost(self, mock_quote, auth_client, sample_stocks):
        mock_quote.return_value = {"price": "150.00"}

        auth_client.post(
            "/api/v1/portfolio/transactions",
            json=_transaction_payload("buy", "10", "100.00", days=0),
        )
        sell_response = auth_client.post(
            "/api/v1/portfolio/transactions",
            json=_transaction_payload("sell", "5", "150.00", days=1),
        )

        assert sell_response.status_code == status.HTTP_201_CREATED

        response = auth_client.get("/api/v1/portfolio/positions/2330")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert _decimal(data["shares"]) == Decimal("5")
        assert _decimal(data["avg_price"]) == Decimal("100.00")
        assert _decimal(data["market_value"]) == Decimal("750.00")
        assert _decimal(data["unrealized_pnl"]) == Decimal("250.00")
        assert _decimal(data["unrealized_pnl_percent"]) == Decimal("50.0")

    @patch("app.routers.portfolio.async_get_realtime_quote")
    def test_multiple_buys_then_partial_sell_preserves_weighted_average(
        self,
        mock_quote,
        auth_client,
        sample_stocks,
    ):
        mock_quote.return_value = {"price": "160.00"}

        auth_client.post(
            "/api/v1/portfolio/transactions",
            json=_transaction_payload("buy", "10", "100.00", days=0),
        )
        auth_client.post(
            "/api/v1/portfolio/transactions",
            json=_transaction_payload("buy", "10", "200.00", days=1),
        )
        auth_client.post(
            "/api/v1/portfolio/transactions",
            json=_transaction_payload("sell", "5", "250.00", days=2),
        )

        response = auth_client.get("/api/v1/portfolio/positions/2330")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert _decimal(data["shares"]) == Decimal("15")
        assert _decimal(data["avg_price"]) == Decimal("150.00")
        assert _decimal(data["market_value"]) == Decimal("2400.00")
        assert _decimal(data["unrealized_pnl"]) == Decimal("150.00")

    @patch("app.routers.portfolio.async_get_realtime_quote")
    def test_full_sell_removes_position(self, mock_quote, auth_client, sample_stocks):
        mock_quote.return_value = {"price": "150.00"}

        auth_client.post(
            "/api/v1/portfolio/transactions",
            json=_transaction_payload("buy", "10", "100.00", days=0),
        )
        auth_client.post(
            "/api/v1/portfolio/transactions",
            json=_transaction_payload("sell", "10", "150.00", days=1),
        )

        list_response = auth_client.get("/api/v1/portfolio/positions")
        assert list_response.status_code == status.HTTP_200_OK
        assert list_response.json() == []

        detail_response = auth_client.get("/api/v1/portfolio/positions/2330")
        assert detail_response.status_code == status.HTTP_404_NOT_FOUND


class TestPortfolioSellValidation:
    def test_sell_without_holdings_returns_400(self, auth_client, sample_stocks, db_session):
        response = auth_client.post(
            "/api/v1/portfolio/transactions",
            json=_transaction_payload("sell", "1", "150.00"),
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert db_session.query(PortfolioTransaction).count() == 0

    def test_sell_more_than_holdings_returns_400(self, auth_client, sample_stocks, db_session):
        auth_client.post(
            "/api/v1/portfolio/transactions",
            json=_transaction_payload("buy", "5", "100.00", days=0),
        )

        response = auth_client.post(
            "/api/v1/portfolio/transactions",
            json=_transaction_payload("sell", "6", "150.00", days=1),
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert db_session.query(PortfolioTransaction).count() == 1

    def test_backdated_sell_that_makes_holdings_negative_returns_400(
        self,
        auth_client,
        sample_stocks,
        db_session,
    ):
        auth_client.post(
            "/api/v1/portfolio/transactions",
            json=_transaction_payload("buy", "5", "100.00", days=1),
        )

        response = auth_client.post(
            "/api/v1/portfolio/transactions",
            json=_transaction_payload("sell", "1", "150.00", days=0),
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert db_session.query(PortfolioTransaction).count() == 1
