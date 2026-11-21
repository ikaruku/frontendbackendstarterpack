"""Backend permission enforcement, user CRUD, admin guards, and audit log tests."""

from fastapi.testclient import TestClient

from app.models import AccessLevel
from tests.conftest import auth_headers


def test_read_permission_blocks_write_operations(client: TestClient, make_user):
    make_user('reader', permissions={'user_management': AccessLevel.read, 'dashboard': AccessLevel.read})
    target = make_user('target_u')

    headers, _ = auth_headers(client, 'reader')

    # Can read users and menu catalog
    assert client.get('/api/users', headers=headers).status_code == 200
    assert client.get('/api/menus/catalog', headers=headers).status_code == 200

    # Visible menus only include granted menus
    menus = client.get('/api/menus', headers=headers).json()
    assert {m['code'] for m in menus} == {'dashboard', 'user_management'}

    # All write endpoints rejected with 403
    assert (
        client.post(
            '/api/users',
            headers=headers,
            json={'username': 'xuser', 'full_name': 'X', 'email': None, 'password': 'Password1', 'is_active': True},
        ).status_code
        == 403
    )
    assert client.patch(f'/api/users/{target.id}/toggle-active', headers=headers).status_code == 403
    assert client.delete(f'/api/users/{target.id}', headers=headers).status_code == 403
    assert client.post(f'/api/users/{target.id}/reset-password', headers=headers).status_code == 403
    assert (
        client.put(
            f'/api/users/{target.id}/permissions',
            headers=headers,
            json={'permissions': {'dashboard': 'read'}},
        ).status_code
        == 403
    )


def test_no_permission_blocks_even_read(client: TestClient, make_user):
    make_user('limited', permissions={'dashboard': AccessLevel.read})
    headers, _ = auth_headers(client, 'limited')
    assert client.get('/api/users', headers=headers).status_code == 403
    assert client.get('/api/audit-logs', headers=headers).status_code == 403


def test_superadmin_crud_permissions_and_audit(client: TestClient, make_user):
    make_user('boss', is_superadmin=True)
    headers, _ = auth_headers(client, 'boss')

    created = client.post(
        '/api/users',
        headers=headers,
        json={
            'username': 'staff1',
            'full_name': 'Staff One',
            'email': 'staff1@test.local',
            'password': 'StaffPassword1',
            'is_active': True,
        },
    )
    assert created.status_code == 201
    uid = created.json()['id']
    assert created.json()['must_change_password'] is True

    # Set permissions
    perm_res = client.put(
        f'/api/users/{uid}/permissions',
        headers=headers,
        json={'permissions': {'dashboard': 'write', 'reports': 'read'}},
    )
    assert perm_res.status_code == 200
    assert perm_res.json()['permissions'] == {'dashboard': 'write', 'reports': 'read'}

    # Reset password returns random temporary password & sets must_change_password
    reset_res = client.post(f'/api/users/{uid}/reset-password', headers=headers)
    assert reset_res.status_code == 200
    temp_pw = reset_res.json()['temporary_password']
    assert len(temp_pw) >= 8

    # Login works with temporary password
    assert client.post('/api/auth/login', json={'username': 'staff1', 'password': temp_pw}).status_code == 200

    # Audit log recorded actions without leaking password
    logs = client.get('/api/audit-logs', headers=headers).json()
    actions = [entry['action'] for entry in logs]
    assert 'user.created' in actions
    assert 'permission.changed' in actions
    assert 'user.password_reset' in actions
    assert temp_pw not in str(logs)


def test_admin_safety_guards_prevent_self_or_last_admin_lockout(client: TestClient, make_user):
    boss = make_user('boss_guard', is_superadmin=True)
    headers, _ = auth_headers(client, 'boss_guard')

    # Cannot delete or deactivate self
    assert client.delete(f'/api/users/{boss.id}', headers=headers).status_code == 400
    assert client.patch(f'/api/users/{boss.id}/toggle-active', headers=headers).status_code == 400
