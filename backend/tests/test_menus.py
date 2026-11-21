"""Menu Management CRUD, permission enforcement, core menu protection, and WebSocket sync tests."""

from fastapi.testclient import TestClient

from app.models import AccessLevel
from tests.conftest import auth_headers


def test_menu_management_requires_permission(client: TestClient, make_user):
    make_user('viewer', permissions={'menu_management': AccessLevel.read})
    make_user('outsider', permissions={'dashboard': AccessLevel.read})

    outsider_headers, _ = auth_headers(client, 'outsider')
    assert client.get('/api/menus/manage', headers=outsider_headers).status_code == 403

    viewer_headers, _ = auth_headers(client, 'viewer')
    assert client.get('/api/menus/manage', headers=viewer_headers).status_code == 200
    assert (
        client.post(
            '/api/menus',
            headers=viewer_headers,
            json={
                'code': 'analytics',
                'name': 'Analytics',
                'group_name': 'Main Menu',
                'icon': 'trend',
                'path': '/analytics',
                'sort_order': 10,
                'is_active': True,
            },
        ).status_code
        == 403
    )


def test_admin_can_crud_menus_and_broadcasts_realtime(client: TestClient, make_user):
    make_user('admin_m', is_superadmin=True)
    headers, body = auth_headers(client, 'admin_m')

    with client.websocket_connect(f"/ws?token={body['access_token']}") as ws:
        assert ws.receive_json()['type'] == 'connected'

        # Create menu
        created = client.post(
            '/api/menus',
            headers=headers,
            json={
                'code': 'analytics',
                'name': 'Analytics',
                'group_name': 'Main Menu',
                'icon': 'trend',
                'path': '/analytics',
                'sort_order': 7,
                'is_active': True,
            },
        )
        assert created.status_code == 201
        menu_id = created.json()['id']

        evt = ws.receive_json()
        assert evt['type'] == 'menu.changed'
        assert evt['payload']['code'] == 'analytics'

        # Update menu
        updated = client.put(
            f'/api/menus/{menu_id}',
            headers=headers,
            json={
                'name': 'Business Analytics',
                'group_name': 'Main Menu',
                'icon': 'activity',
                'path': '/business-analytics',
                'sort_order': 8,
                'is_active': True,
            },
        )
        assert updated.status_code == 200
        assert updated.json()['name'] == 'Business Analytics'
        assert ws.receive_json()['type'] == 'menu.changed'

        # Toggle inactive hides from /api/menus/catalog but keeps in /api/menus/manage
        toggled = client.patch(f'/api/menus/{menu_id}/toggle-active', headers=headers)
        assert toggled.status_code == 200
        assert toggled.json()['is_active'] is False
        assert ws.receive_json()['type'] == 'menu.changed'

        catalog_codes = {m['code'] for m in client.get('/api/menus/catalog', headers=headers).json()}
        assert 'analytics' not in catalog_codes
        assert 'settings' not in catalog_codes
        assert 'menu_management' in catalog_codes

        # Delete custom menu
        deleted = client.delete(f'/api/menus/{menu_id}', headers=headers)
        assert deleted.status_code == 200
        assert ws.receive_json()['type'] == 'menu.changed'


def test_core_menus_cannot_be_deleted_or_deactivated(client: TestClient, make_user):
    make_user('admin_core', is_superadmin=True)
    headers, _ = auth_headers(client, 'admin_core')

    all_menus = client.get('/api/menus/manage', headers=headers).json()
    by_code = {m['code']: m for m in all_menus}

    for code in ('user_management', 'menu_management'):
        mid = by_code[code]['id']
        assert client.patch(f'/api/menus/{mid}/toggle-active', headers=headers).status_code == 400
        assert client.delete(f'/api/menus/{mid}', headers=headers).status_code == 400


def test_submenu_creation_rules_and_user_visibility(client: TestClient, make_user):
    make_user('admin_sub', is_superadmin=True)
    headers, _ = auth_headers(client, 'admin_sub')

    all_menus = client.get('/api/menus/manage', headers=headers).json()
    reports = next(m for m in all_menus if m['code'] == 'reports')

    # Create sub-menu under Reports
    sub_res = client.post(
        '/api/menus',
        headers=headers,
        json={
            'code': 'sales_report',
            'name': 'Sales Report',
            'group_name': 'Administration',  # must auto-align to parent's Main Menu
            'icon': 'trend',
            'path': '/reports/sales',
            'parent_id': reports['id'],
            'sort_order': 1,
            'is_active': True,
        },
    )
    assert sub_res.status_code == 201
    sub = sub_res.json()
    assert sub['parent_id'] == reports['id']
    assert sub['group_name'] == reports['group_name']

    # Cannot nest a 2nd-level sub-menu under a sub-menu
    deep_res = client.post(
        '/api/menus',
        headers=headers,
        json={
            'code': 'deep_report',
            'name': 'Deep Report',
            'group_name': 'Main Menu',
            'icon': 'file',
            'path': '/reports/sales/deep',
            'parent_id': sub['id'],
            'sort_order': 1,
            'is_active': True,
        },
    )
    assert deep_res.status_code == 400

    # Parent with sub-menus cannot be deleted or turned into a sub-menu
    assert client.delete(f"/api/menus/{reports['id']}", headers=headers).status_code == 400

    # User granted access ONLY to the sub-menu receives both sub-menu and parent container in /api/menus
    make_user('sales_viewer', permissions={'sales_report': AccessLevel.read})
    viewer_headers, _ = auth_headers(client, 'sales_viewer')
    viewer_codes = {m['code'] for m in client.get('/api/menus', headers=viewer_headers).json()}
    assert viewer_codes == {'reports', 'sales_report'}
