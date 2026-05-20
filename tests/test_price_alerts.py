from decimal import Decimal

from app.models import PriceAlert


def _create_alert(auth_client, target_price="850.00"):
    response = auth_client.post(
        "/api/v1/price-alerts",
        json={
            "symbol": "2330",
            "condition": "above",
            "target_price": target_price,
        },
    )
    assert response.status_code == 201
    return response.json()


class TestPriceAlertUpdates:
    def test_update_target_price_accepts_positive_value(self, auth_client, sample_stocks):
        alert = _create_alert(auth_client)

        response = auth_client.patch(
            f"/api/v1/price-alerts/{alert['id']}",
            json={"target_price": "900.50"},
        )

        assert response.status_code == 200
        assert Decimal(response.json()["target_price"]) == Decimal("900.50")

    def test_update_target_price_rejects_zero_and_negative_values(
        self,
        auth_client,
        sample_stocks,
        db_session,
    ):
        alert = _create_alert(auth_client)

        for invalid_target_price in ("0", "-1.00"):
            response = auth_client.patch(
                f"/api/v1/price-alerts/{alert['id']}",
                json={"target_price": invalid_target_price},
            )

            assert response.status_code == 422

        db_session.expire_all()
        stored_alert = (
            db_session.query(PriceAlert)
            .filter(PriceAlert.id == alert["id"])
            .one()
        )
        assert stored_alert.target_price == Decimal("850.00")

    def test_update_allows_partial_update_without_target_price(self, auth_client, sample_stocks):
        alert = _create_alert(auth_client, target_price="875.00")

        response = auth_client.patch(
            f"/api/v1/price-alerts/{alert['id']}",
            json={"is_active": False},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["is_active"] is False
        assert Decimal(data["target_price"]) == Decimal("875.00")
