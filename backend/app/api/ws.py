"""Authenticated WebSocket endpoint for realtime UI synchronization."""

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect, status

from app.core.deps import load_active_user
from app.core.security import decode_access_token
from app.db.session import SessionLocal
from app.realtime.manager import manager

router = APIRouter(tags=['Realtime'])


@router.websocket('/ws')
async def websocket_endpoint(websocket: WebSocket, token: str | None = Query(default=None)) -> None:
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason='Authentication required')
        return

    user_id = decode_access_token(token)
    if user_id is None:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason='Invalid token')
        return

    with SessionLocal() as session:
        user = load_active_user(session, user_id)
        if user is None:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason='Inactive user')
            return

    await manager.connect(user_id, websocket)
    try:
        await websocket.send_json({'type': 'connected', 'payload': {'user_id': user_id}})
        while True:
            text = await websocket.receive_text()
            if text == 'ping':
                await websocket.send_json({'type': 'pong'})
    except WebSocketDisconnect:
        manager.disconnect(user_id, websocket)
    except Exception:
        manager.disconnect(user_id, websocket)
