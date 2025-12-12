"""Тесты REST-запросов, связанных с пользователями и регистрацией."""

from main import User


def test_login_returns_access_token(client):
    """Успешный логин возвращает bearer-токен."""
    response = client.post(
        "/api/login",
        json={"username": "doctor", "password": "doctorpass"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]


def test_register_prevents_duplicates(client, db_session):
    """Регистрация с существующим логином блокируется."""
    db_session.add(User(username="unique", hashed_password="x", name="Name", position="Role"))
    db_session.commit()

    response = client.post(
        "/api/register",
        json={
            "username": "unique",
            "password": "secret",
            "name": "Another User",
            "position": "Nurse",
        },
    )
    assert response.status_code == 400


def test_admin_can_list_users(client):
    """Администратор получает список пользователей со статусом 200."""
    response = client.get("/api/users/")
    assert response.status_code == 200
    assert len(response.json()) >= 2


def test_get_me_returns_active_user(client):
    """Запрос профиля /api/me возвращает текущего пользователя."""
    response = client.get("/api/me")
    assert response.status_code == 200
    body = response.json()
    assert body["username"] == "doctor"
