"""Проверки вспомогательных функций аутентификации FastAPI-приложения."""

import asyncio
from jose import jwt

from main import ALGORITHM, SECRET_KEY, authenticate_user, create_access_token, get_password_hash, verify_password


def test_verify_password_success():
    """Пароль проходит проверку, если соответствует исходному хэшу."""
    hashed = get_password_hash("secret")
    assert verify_password("secret", hashed)


def test_verify_password_failure():
    """Неверный пароль не проходит проверку."""
    hashed = get_password_hash("secret")
    assert verify_password("wrong", hashed) is False


def test_authenticate_user_success(db_session):
    """Успешная аутентификация существующего пользователя возвращает модель User."""
    user = asyncio.run(authenticate_user(db_session, "doctor", "doctorpass"))
    assert user is not False
    assert user.username == "doctor"


def test_authenticate_user_wrong_password(db_session):
    """Неверный пароль приводит к отказу в аутентификации."""
    result = asyncio.run(authenticate_user(db_session, "doctor", "bad"))
    assert result is False


def test_create_access_token_contains_subject():
    """Созданный JWT содержит subject и срок действия."""
    token = create_access_token({"sub": "doctor"})
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    assert payload["sub"] == "doctor"
    assert "exp" in payload
