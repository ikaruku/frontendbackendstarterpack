"""Pytest fixtures: isolated PostgreSQL transaction rollback per test."""

from contextlib import nullcontext

from fastapi.testclient import TestClient
import pytest
from sqlalchemy.orm import Session

import app.api.ws as ws_module
from app.core.rate_limit import login_limiter
from app.core.security import hash_password
from app.db.session import engine, get_session
from app.main import app
from app.models import AccessLevel, Menu, User, UserMenuPermission


@pytest.fixture()
def db_session():
    """Run each test inside an outer transaction that rolls back afterwards."""
    connection = engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection, join_transaction_mode='create_savepoint')
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture()
def client(db_session: Session, monkeypatch: pytest.MonkeyPatch):
    """TestClient wired to the isolated database session."""
    login_limiter.clear_all()

    def _override_session():
        yield db_session

    app.dependency_overrides[get_session] = _override_session
    monkeypatch.setattr(ws_module, 'SessionLocal', lambda: nullcontext(db_session))
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    login_limiter.clear_all()


@pytest.fixture()
def make_user(db_session: Session):
    """Factory to insert test users with optional menu permissions inside the rolled-back tx."""

    def _create(
        username: str,
        password: str = 'TestPass123',
        is_superadmin: bool = False,
        is_active: bool = True,
        must_change_password: bool = False,
        permissions: dict[str, AccessLevel] | None = None,
    ) -> User:
        user = User(
            username=username,
            full_name=username.title(),
            email=f'{username}@test.local',
            password_hash=hash_password(password),
            is_active=is_active,
            is_superadmin=is_superadmin,
            must_change_password=must_change_password,
        )
        db_session.add(user)
        db_session.flush()
        if permissions:
            menus = {m.code: m for m in db_session.query(Menu).all()}
            for code, level in permissions.items():
                db_session.add(
                    UserMenuPermission(user_id=user.id, menu_id=menus[code].id, access_level=level)
                )
        db_session.commit()
        return user

    return _create


def auth_headers(client: TestClient, username: str, password: str = 'TestPass123') -> tuple[dict[str, str], dict]:
    res = client.post('/api/auth/login', json={'username': username, 'password': password})
    assert res.status_code == 200, res.text
    body = res.json()
    return {'Authorization': f"Bearer {body['access_token']}"}, body
