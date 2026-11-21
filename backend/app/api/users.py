"""User management and per-menu permission routes."""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.deps import require_permission
from app.db.session import get_session
from app.models import User
from app.realtime.events import disconnect_user_sessions, emit_event
from app.schemas.auth import MessageResponse
from app.schemas.user import (
    ResetPasswordResponse,
    UserCreate,
    UserOut,
    UserPermissionsUpdate,
    UserUpdate,
)
from app.services.permission_service import to_user_out, update_user_permissions
from app.services.user_service import (
    create_user,
    delete_user,
    list_users,
    reset_user_password,
    toggle_user_active,
    update_user,
)

router = APIRouter(prefix='/api/users', tags=['Users'])


@router.get('', response_model=list[UserOut])
def get_users(
    search: str | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    _actor: User = Depends(require_permission('user_management', 'read')),
    session: Session = Depends(get_session),
) -> list[UserOut]:
    return [to_user_out(u) for u in list_users(session, search=search, is_active=is_active)]


@router.post('', response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def post_user(
    payload: UserCreate,
    actor: User = Depends(require_permission('user_management', 'write')),
    session: Session = Depends(get_session),
) -> UserOut:
    user = create_user(session, actor.id, payload)
    await emit_event('user.created', {'user_id': user.id})
    return to_user_out(user)


@router.put('/{user_id}', response_model=UserOut)
async def put_user(
    user_id: int,
    payload: UserUpdate,
    actor: User = Depends(require_permission('user_management', 'write')),
    session: Session = Depends(get_session),
) -> UserOut:
    user, became_inactive = update_user(session, actor.id, user_id, payload)
    if became_inactive:
        await emit_event('user.deactivated', {'user_id': user.id})
        await disconnect_user_sessions(user.id, reason='Account deactivated')
    else:
        await emit_event('user.updated', {'user_id': user.id})
    return to_user_out(user)


@router.patch('/{user_id}/toggle-active', response_model=UserOut)
async def patch_toggle_active(
    user_id: int,
    actor: User = Depends(require_permission('user_management', 'write')),
    session: Session = Depends(get_session),
) -> UserOut:
    user = toggle_user_active(session, actor.id, user_id)
    if not user.is_active:
        await emit_event('user.deactivated', {'user_id': user.id})
        await disconnect_user_sessions(user.id, reason='Account deactivated')
    else:
        await emit_event('user.updated', {'user_id': user.id})
    return to_user_out(user)


@router.delete('/{user_id}', response_model=MessageResponse)
async def remove_user(
    user_id: int,
    actor: User = Depends(require_permission('user_management', 'write')),
    session: Session = Depends(get_session),
) -> MessageResponse:
    username = delete_user(session, actor.id, user_id)
    await emit_event('user.deleted', {'user_id': user_id})
    await disconnect_user_sessions(user_id, reason='Account deleted')
    return MessageResponse(message=f'User @{username} deleted.')


@router.post('/{user_id}/reset-password', response_model=ResetPasswordResponse)
async def post_reset_password(
    user_id: int,
    actor: User = Depends(require_permission('user_management', 'write')),
    session: Session = Depends(get_session),
) -> ResetPasswordResponse:
    user, temp_password = reset_user_password(session, actor.id, user_id)
    await emit_event('user.updated', {'user_id': user.id})
    await disconnect_user_sessions(user.id, reason='Password reset by administrator')
    return ResetPasswordResponse(user_id=user.id, temporary_password=temp_password)


@router.put('/{user_id}/permissions', response_model=UserOut)
async def put_permissions(
    user_id: int,
    payload: UserPermissionsUpdate,
    actor: User = Depends(require_permission('user_management', 'write')),
    session: Session = Depends(get_session),
) -> UserOut:
    user = update_user_permissions(session, actor.id, user_id, payload.permissions)
    await emit_event('permission.changed', {'user_id': user.id})
    return to_user_out(user)
