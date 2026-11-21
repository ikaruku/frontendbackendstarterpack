"""Authentication, refresh cookie rotation, password change, and rate-limit tests."""

from fastapi.testclient import TestClient

from app.core.config import settings
from tests.conftest import auth_headers


def test_health_ok(client: TestClient):
    res = client.get('/api/health')
    assert res.status_code == 200
    assert res.json() == {'status': 'ok'}


def test_login_refresh_and_logout(client: TestClient, make_user):
    make_user('alice', password='AlicePass123')

    headers, body = auth_headers(client, 'alice', 'AlicePass123')
    assert body['user']['username'] == 'alice'
    assert settings.refresh_cookie_name in client.cookies

    me_res = client.get('/api/auth/me', headers=headers)
    assert me_res.status_code == 200
    assert me_res.json()['username'] == 'alice'

    old_cookie = client.cookies[settings.refresh_cookie_name]
    refresh_res = client.post('/api/auth/refresh')
    assert refresh_res.status_code == 200
    assert refresh_res.json()['access_token']
    assert client.cookies[settings.refresh_cookie_name] != old_cookie

    logout_res = client.post('/api/auth/logout')
    assert logout_res.status_code == 200
    assert client.post('/api/auth/refresh').status_code == 401


def test_login_rate_limit_blocks_after_max_failures(client: TestClient, make_user):
    make_user('bob', password='BobPass123')

    for _ in range(settings.login_rate_limit_max):
        res = client.post('/api/auth/login', json={'username': 'bob', 'password': 'WrongPassword1'})
        assert res.status_code == 401

    blocked = client.post('/api/auth/login', json={'username': 'bob', 'password': 'BobPass123'})
    assert blocked.status_code == 429
    assert 'Retry-After' in blocked.headers


def test_change_password_updates_hash_and_flag(client: TestClient, make_user):
    make_user('carol', password='OldPass123', must_change_password=True)
    headers, _ = auth_headers(client, 'carol', 'OldPass123')

    bad = client.post(
        '/api/auth/change-password',
        headers=headers,
        json={'current_password': 'WrongOld1', 'new_password': 'NewPass456'},
    )
    assert bad.status_code == 400

    ok = client.post(
        '/api/auth/change-password',
        headers=headers,
        json={'current_password': 'OldPass123', 'new_password': 'NewPass456'},
    )
    assert ok.status_code == 200
    assert ok.json()['user']['must_change_password'] is False

    # Old password fails, new password succeeds
    assert client.post('/api/auth/login', json={'username': 'carol', 'password': 'OldPass123'}).status_code == 401
    assert client.post('/api/auth/login', json={'username': 'carol', 'password': 'NewPass456'}).status_code == 200
