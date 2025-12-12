import os
import sys
from pathlib import Path

import pytest

# Базовая директория backend, чтобы корректно импортировать приложение FastAPI
BACKEND_ROOT = Path(__file__).resolve().parents[2] / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

# Используем файловую SQLite-базу для стабильных тестов
os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")

from main import (  # noqa: E402
    Base,
    SessionLocal,
    app,
    engine,
    get_db,
    get_current_active_user,
    get_current_admin_user,
    get_password_hash,
    User,
)


@pytest.fixture(autouse=True)
def clean_database():
    """Перед каждым тестом пересоздаём схему БД, чтобы гарантировать чистую среду."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


@pytest.fixture
def db_session(clean_database):
    """Создаёт сеанс БД с двумя пользователями: админ и врач."""
    session = SessionLocal()

    admin = User(
        username="admin",
        hashed_password=get_password_hash("adminpass"),
        name="Admin User",
        position="Administrator",
        is_admin=True,
        is_active=True,
    )
    staff = User(
        username="doctor",
        hashed_password=get_password_hash("doctorpass"),
        name="Doctor Who",
        position="Physician",
        is_admin=False,
        is_active=True,
    )
    session.add_all([admin, staff])
    session.commit()
    yield session
    session.close()


@pytest.fixture
def override_dependencies(db_session):
    """Подменяет зависимости FastAPI, чтобы тесты работали без внешних сервисов."""

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    async def override_current_active_user():
        return db_session.query(User).filter_by(username="doctor").first()

    async def override_current_admin_user():
        return db_session.query(User).filter_by(username="admin").first()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_active_user] = override_current_active_user
    app.dependency_overrides[get_current_admin_user] = override_current_admin_user
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def client(override_dependencies):
    """HTTP-клиент для вызова эндпоинтов FastAPI в тестах."""
    from fastapi.testclient import TestClient

    return TestClient(app)
