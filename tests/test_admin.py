
from app.models import User


class TestAdminAccess:
    def test_admin_can_list_users(self, admin_client, auth_client):
        resp = admin_client.get("/api/v1/admin/users")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        # Verify both admin and regular user appear
        usernames = {u["username"] for u in data}
        assert "adminuser" in usernames

    def test_admin_can_get_user(self, admin_client, auth_client):
        # Get the regular user's ID from the list
        resp = admin_client.get("/api/v1/admin/users")
        users = resp.json()
        regular_user = next(u for u in users if u["username"] != "adminuser")
        user_id = regular_user["id"]

        resp = admin_client.get(f"/api/v1/admin/users/{user_id}")
        assert resp.status_code == 200
        assert resp.json()["id"] == user_id

    def test_admin_can_update_user_role(self, admin_client, auth_client):
        resp = admin_client.get("/api/v1/admin/users")
        users = resp.json()
        regular_user = next(u for u in users if u["username"] != "adminuser")
        user_id = regular_user["id"]

        resp = admin_client.patch(f"/api/v1/admin/users/{user_id}", json={"role": "admin"})
        assert resp.status_code == 200
        assert resp.json()["role"] == "admin"

    def test_admin_can_deactivate_user(self, admin_client, auth_client):
        resp = admin_client.get("/api/v1/admin/users")
        users = resp.json()
        regular_user = next(u for u in users if u["username"] != "adminuser")
        user_id = regular_user["id"]

        resp = admin_client.patch(f"/api/v1/admin/users/{user_id}", json={"is_active": False})
        assert resp.status_code == 200
        assert resp.json()["is_active"] is False

    def test_admin_can_delete_user(self, admin_client, auth_client):
        resp = admin_client.get("/api/v1/admin/users")
        users = resp.json()
        regular_user = next(u for u in users if u["username"] != "adminuser")
        user_id = regular_user["id"]

        resp = admin_client.delete(f"/api/v1/admin/users/{user_id}")
        assert resp.status_code == 204

        resp = admin_client.get(f"/api/v1/admin/users/{user_id}")
        assert resp.status_code == 404

    def test_admin_cannot_delete_self(self, admin_client):
        # Get admin user ID
        resp = admin_client.get("/api/v1/admin/users")
        users = resp.json()
        admin_user = next(u for u in users if u["username"] == "adminuser")
        admin_id = admin_user["id"]

        resp = admin_client.delete(f"/api/v1/admin/users/{admin_id}")
        assert resp.status_code == 400
        assert "Cannot delete your own account" in resp.json()["detail"]

    def test_admin_cannot_deactivate_self(self, admin_client):
        resp = admin_client.get("/api/v1/admin/users")
        users = resp.json()
        admin_user = next(u for u in users if u["username"] == "adminuser")
        admin_id = admin_user["id"]

        resp = admin_client.patch(f"/api/v1/admin/users/{admin_id}", json={"is_active": False})
        assert resp.status_code == 400
        assert "Cannot deactivate your own account" in resp.json()["detail"]

    def test_admin_cannot_demote_self(self, admin_client):
        resp = admin_client.get("/api/v1/admin/users")
        users = resp.json()
        admin_user = next(u for u in users if u["username"] == "adminuser")
        admin_id = admin_user["id"]

        resp = admin_client.patch(f"/api/v1/admin/users/{admin_id}", json={"role": "user"})
        assert resp.status_code == 400
        assert "Cannot demote yourself from admin" in resp.json()["detail"]


class TestNonAdminAccess:
    def test_regular_user_cannot_list_users(self, auth_client):
        resp = auth_client.get("/api/v1/admin/users")
        assert resp.status_code == 403
        assert "Admin access required" in resp.json()["detail"]

    def test_regular_user_cannot_get_user(self, auth_client):
        resp = auth_client.get("/api/v1/admin/users/1")
        assert resp.status_code == 403

    def test_regular_user_cannot_update_user(self, auth_client):
        resp = auth_client.patch("/api/v1/admin/users/1", json={"role": "admin"})
        assert resp.status_code == 403

    def test_regular_user_cannot_delete_user(self, auth_client):
        resp = auth_client.delete("/api/v1/admin/users/1")
        assert resp.status_code == 403

    def test_unauthenticated_user_cannot_access_admin(self, client):
        resp = client.get("/api/v1/admin/users")
        assert resp.status_code == 401


class TestAdminPagination:
    def test_pagination_defaults(self, admin_client):
        resp = admin_client.get("/api/v1/admin/users")
        assert resp.status_code == 200
        # Should return all users (default limit 20 is plenty for tests)

    def test_pagination_with_limit(self, admin_client):
        resp = admin_client.get("/api/v1/admin/users?limit=1")
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    def test_pagination_with_skip(self, admin_client, db_session):
        # Ensure at least 2 users exist
        extra = User(username="extrauser", email="extra@example.com", hashed_password="x")
        db_session.add(extra)
        db_session.commit()

        resp = admin_client.get("/api/v1/admin/users?skip=0&limit=1")
        first = resp.json()
        resp = admin_client.get("/api/v1/admin/users?skip=1&limit=1")
        second = resp.json()
        assert len(first) == 1
        assert len(second) == 1
        assert first[0]["id"] != second[0]["id"]
