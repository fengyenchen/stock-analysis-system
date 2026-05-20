

class TestPublicContentVisibility:
    def test_public_visibility_returns_all_keys(self, client):
        resp = client.get("/api/v1/content-visibility/public")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) == 18
        keys = {item["content_key"] for item in data}
        assert "price_chart" in keys
        assert "technical_indicators" in keys
        # Default should be visible
        assert all(item["is_visible"] is True for item in data)


class TestAuthenticatedContentVisibility:
    def test_authenticated_visibility_returns_all_keys(self, auth_client):
        resp = auth_client.get("/api/v1/content-visibility")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 18


class TestAdminGlobalVisibility:
    def test_admin_can_set_global_visibility(self, admin_client):
        resp = admin_client.patch("/api/v1/admin/content-visibility/global/price_chart", json={"is_visible": False})
        assert resp.status_code == 200
        assert resp.json()["is_visible"] is False
        assert resp.json()["scope"] == "global"

    def test_global_visibility_affects_public(self, admin_client, client):
        # Hide price_chart globally
        admin_client.patch("/api/v1/admin/content-visibility/global/price_chart", json={"is_visible": False})

        resp = client.get("/api/v1/content-visibility/public")
        data = {item["content_key"]: item["is_visible"] for item in resp.json()}
        assert data["price_chart"] is False
        # Others still visible
        assert data["technical_indicators"] is True

    def test_invalid_content_key_returns_400(self, admin_client):
        resp = admin_client.patch("/api/v1/admin/content-visibility/global/invalid_key", json={"is_visible": False})
        assert resp.status_code == 400


class TestAdminUserOverride:
    def test_admin_can_set_user_override(self, admin_client, auth_client, db_session):
        from app.models import User

        # Get the regular user's ID
        user = db_session.query(User).filter(User.username == "testuser").first()
        assert user

        # Set global visible first
        admin_client.patch("/api/v1/admin/content-visibility/global/price_chart", json={"is_visible": True})

        # Hide for specific user
        resp = admin_client.patch(
            f"/api/v1/admin/content-visibility/users/{user.id}/price_chart",
            json={"is_visible": False}
        )
        assert resp.status_code == 200
        assert resp.json()["is_visible"] is False
        assert resp.json()["scope"] == "user"

    def test_user_override_takes_precedence(self, admin_client, auth_client, db_session):
        from app.models import User

        user = db_session.query(User).filter(User.username == "testuser").first()

        # Hide globally
        admin_client.patch("/api/v1/admin/content-visibility/global/price_chart", json={"is_visible": False})
        # Show for specific user
        admin_client.patch(
            f"/api/v1/admin/content-visibility/users/{user.id}/price_chart",
            json={"is_visible": True}
        )

        # Regular user should see it (override takes precedence)
        resp = auth_client.get("/api/v1/content-visibility")
        data = {item["content_key"]: item["is_visible"] for item in resp.json()}
        assert data["price_chart"] is True

    def test_delete_user_override_reverts_to_global(self, admin_client, auth_client, db_session):
        from app.models import User

        user = db_session.query(User).filter(User.username == "testuser").first()

        # Hide globally
        admin_client.patch("/api/v1/admin/content-visibility/global/price_chart", json={"is_visible": False})
        # Show for specific user
        admin_client.patch(
            f"/api/v1/admin/content-visibility/users/{user.id}/price_chart",
            json={"is_visible": True}
        )

        # Delete override
        resp = admin_client.delete(f"/api/v1/admin/content-visibility/users/{user.id}/price_chart")
        assert resp.status_code == 204

        # Now should follow global (hidden)
        resp = auth_client.get("/api/v1/content-visibility")
        data = {item["content_key"]: item["is_visible"] for item in resp.json()}
        assert data["price_chart"] is False

    def test_non_admin_cannot_access_admin_visibility(self, auth_client):
        resp = auth_client.get("/api/v1/admin/content-visibility")
        assert resp.status_code == 403

    def test_non_admin_cannot_set_global_visibility(self, auth_client):
        resp = auth_client.patch("/api/v1/admin/content-visibility/global/price_chart", json={"is_visible": False})
        assert resp.status_code == 403

    def test_non_admin_cannot_set_user_visibility(self, auth_client):
        resp = auth_client.patch("/api/v1/admin/content-visibility/users/1/price_chart", json={"is_visible": False})
        assert resp.status_code == 403
