"""Authenticated WebSocket connection manager."""

from collections import defaultdict
from datetime import UTC, datetime

from fastapi import WebSocket


class ConnectionManager:
    """Tracks active WebSocket connections keyed by user_id."""

    def __init__(self) -> None:
        self._connections: dict[int, set[WebSocket]] = defaultdict(set)

    async def connect(self, user_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections[user_id].add(websocket)

    def disconnect(self, user_id: int, websocket: WebSocket) -> None:
        sockets = self._connections.get(user_id)
        if not sockets:
            return
        sockets.discard(websocket)
        if not sockets:
            self._connections.pop(user_id, None)

    async def broadcast(self, event_type: str, payload: dict) -> None:
        message = {'type': event_type, 'payload': payload, 'timestamp': datetime.now(UTC).isoformat()}
        stale: list[tuple[int, WebSocket]] = []
        for user_id, sockets in list(self._connections.items()):
            for ws in list(sockets):
                try:
                    await ws.send_json(message)
                except Exception:
                    stale.append((user_id, ws))
        for user_id, ws in stale:
            self.disconnect(user_id, ws)

    async def send_to_user(self, user_id: int, event_type: str, payload: dict) -> None:
        message = {'type': event_type, 'payload': payload, 'timestamp': datetime.now(UTC).isoformat()}
        for ws in list(self._connections.get(user_id, set())):
            try:
                await ws.send_json(message)
            except Exception:
                self.disconnect(user_id, ws)

    async def disconnect_user(self, user_id: int, code: int = 4003, reason: str = 'Account deactivated') -> None:
        for ws in list(self._connections.get(user_id, set())):
            try:
                await ws.close(code=code, reason=reason)
            except Exception:
                pass
            finally:
                self.disconnect(user_id, ws)


manager = ConnectionManager()
