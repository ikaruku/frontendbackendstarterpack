"""Single abstraction layer for realtime event emission.

All features call functions here instead of talking to WebSockets directly,
so switching to Redis pub/sub during multi-instance scale-out only touches `realtime/`.
"""

from app.realtime.manager import manager


async def emit_event(event_type: str, payload: dict) -> None:
    """Broadcast a domain event to all connected authenticated clients."""
    await manager.broadcast(event_type, payload)


async def emit_user_event(user_id: int, event_type: str, payload: dict) -> None:
    """Send an event targeted to a single user's active connections."""
    await manager.send_to_user(user_id, event_type, payload)


async def disconnect_user_sessions(user_id: int, reason: str = 'Session terminated') -> None:
    """Close all active WebSockets for a deactivated or deleted user."""
    await manager.disconnect_user(user_id, reason=reason)
