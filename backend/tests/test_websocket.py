"""Authenticated WebSocket connection and realtime event broadcast tests."""

from fastapi.testclient import TestClient
import pytest
from starlette.websockets import WebSocketDisconnect

from app.models import AccessLevel
from tests.conftest import auth_headers


def test_websocket_rejects_unauthenticated_connection(client: TestClient):
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect('/ws'):
            pass

    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect('/ws?token=invalid.jwt.token'):
            pass


def test_websocket_receives_permission_changed_event(client: TestClient, make_user):
    make_user('admin_ws', is_superadmin=True)
    staff = make_user('staff_ws', permissions={'dashboard': AccessLevel.read})

    admin_headers, _ = auth_headers(client, 'admin_ws')
    _, staff_body = auth_headers(client, 'staff_ws')

    with client.websocket_connect(f"/ws?token={staff_body['access_token']}") as ws:
        hello = ws.receive_json()
        assert hello['type'] == 'connected'

        res = client.put(
            f'/api/users/{staff.id}/permissions',
            headers=admin_headers,
            json={'permissions': {'dashboard': 'write'}},
        )
        assert res.status_code == 200

        event = ws.receive_json()
        assert event['type'] == 'permission.changed'
        assert event['payload']['user_id'] == staff.id
