"""Menu listing and Menu Management CRUD routes."""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_permission
from app.db.session import get_session
from app.models import User
from app.realtime.events import emit_event
from app.schemas.auth import MessageResponse
from app.schemas.menu import MenuCreate, MenuOut, MenuUpdate
from app.services.menu_service import (
    create_menu,
    delete_menu,
    list_all_menus,
    toggle_menu_active,
    update_menu,
)
from app.services.permission_service import list_accessible_menus, list_active_menus

router = APIRouter(prefix='/api/menus', tags=['Menus'])


@router.get('', response_model=list[MenuOut])
def get_my_menus(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[MenuOut]:
    return [MenuOut.model_validate(m) for m in list_accessible_menus(session, current_user)]


@router.get('/catalog', response_model=list[MenuOut])
def get_menu_catalog(
    _actor: User = Depends(require_permission('user_management', 'read')),
    session: Session = Depends(get_session),
) -> list[MenuOut]:
    return [MenuOut.model_validate(m) for m in list_active_menus(session)]


@router.get('/manage', response_model=list[MenuOut])
def get_managed_menus(
    search: str | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    _actor: User = Depends(require_permission('menu_management', 'read')),
    session: Session = Depends(get_session),
) -> list[MenuOut]:
    return [MenuOut.model_validate(m) for m in list_all_menus(session, search=search, is_active=is_active)]


@router.post('', response_model=MenuOut, status_code=status.HTTP_201_CREATED)
async def post_menu(
    payload: MenuCreate,
    actor: User = Depends(require_permission('menu_management', 'write')),
    session: Session = Depends(get_session),
) -> MenuOut:
    menu = create_menu(session, actor.id, payload)
    await emit_event('menu.changed', {'menu_id': menu.id, 'code': menu.code})
    return MenuOut.model_validate(menu)


@router.put('/{menu_id}', response_model=MenuOut)
async def put_menu(
    menu_id: int,
    payload: MenuUpdate,
    actor: User = Depends(require_permission('menu_management', 'write')),
    session: Session = Depends(get_session),
) -> MenuOut:
    menu = update_menu(session, actor.id, menu_id, payload)
    await emit_event('menu.changed', {'menu_id': menu.id, 'code': menu.code})
    return MenuOut.model_validate(menu)


@router.patch('/{menu_id}/toggle-active', response_model=MenuOut)
async def patch_toggle_menu_active(
    menu_id: int,
    actor: User = Depends(require_permission('menu_management', 'write')),
    session: Session = Depends(get_session),
) -> MenuOut:
    menu = toggle_menu_active(session, actor.id, menu_id)
    await emit_event('menu.changed', {'menu_id': menu.id, 'code': menu.code})
    return MenuOut.model_validate(menu)


@router.delete('/{menu_id}', response_model=MessageResponse)
async def remove_menu(
    menu_id: int,
    actor: User = Depends(require_permission('menu_management', 'write')),
    session: Session = Depends(get_session),
) -> MessageResponse:
    code = delete_menu(session, actor.id, menu_id)
    await emit_event('menu.changed', {'menu_id': menu_id, 'code': code})
    return MessageResponse(message=f'Menu "{code}" deleted.')
