import pytest


class TestTargetPricesPublicReads:
    def test_list_target_prices_is_public(self, client, sample_stocks):
        resp = client.get("/api/v1/stocks/2330/target-prices")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)


class TestTargetPricesAdminWrites:
    def test_create_target_price_requires_admin(self, auth_client, sample_stocks):
        payload = {
            "analyst": "Goldman Sachs",
            "target_price": "850.00",
            "rating": "buy",
            "report_date": "2024-01-15",
        }
        resp = auth_client.post("/api/v1/stocks/2330/target-prices", json=payload)
        assert resp.status_code == 403
        assert "Admin access required" in resp.json()["detail"]

    def test_delete_target_price_requires_admin(self, admin_client, auth_client, sample_stocks, db_session):
        from app.models import StockTargetPrice
        # Admin creates a target price
        payload = {
            "analyst": "Goldman Sachs",
            "target_price": "850.00",
            "rating": "buy",
            "report_date": "2024-01-15",
        }
        resp = admin_client.post("/api/v1/stocks/2330/target-prices", json=payload)
        assert resp.status_code == 201
        target_id = resp.json()["id"]

        # Regular user cannot delete
        resp = auth_client.delete(f"/api/v1/stocks/2330/target-prices/{target_id}")
        assert resp.status_code == 403

        # Admin can delete
        resp = admin_client.delete(f"/api/v1/stocks/2330/target-prices/{target_id}")
        assert resp.status_code == 204

    def test_admin_can_create_target_price(self, admin_client, sample_stocks):
        payload = {
            "analyst": "Morgan Stanley",
            "target_price": "900.00",
            "rating": "strong_buy",
            "report_date": "2024-02-01",
        }
        resp = admin_client.post("/api/v1/stocks/2330/target-prices", json=payload)
        assert resp.status_code == 201
        data = resp.json()
        assert data["analyst"] == "Morgan Stanley"
        assert data["rating"] == "strong_buy"

    def test_create_target_price_for_missing_stock_returns_404(self, admin_client):
        payload = {
            "analyst": "Test",
            "target_price": "100.00",
            "rating": "buy",
            "report_date": "2024-01-01",
        }
        resp = admin_client.post("/api/v1/stocks/9999/target-prices", json=payload)
        assert resp.status_code == 404
