"""Menu management business logic (CRUD, sub-menus, and system menu protection)."""

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models import Menu
from app.schemas.menu import MenuCreate, MenuUpdate
from app.services.audit_service import record_audit

PROTECTED_MENU_CODES = {'user_management', 'menu_management'}


def list_all_menus(session: Session, search: str | None = None, is_active: bool | None = None) -> list[Menu]:
    """Return all menus (active and inactive) ordered by sort_order."""
    stmt = select(Menu).order_by(Menu.sort_order.asc(), Menu.id.asc())
    if is_active is not None:
        stmt = stmt.where(Menu.is_active.is_(is_active))
    if search and search.strip():
        pattern = f'%{search.strip()}%'
        stmt = stmt.where(
            or_(
                Menu.code.ilike(pattern),
                Menu.name.ilike(pattern),
                Menu.group_name.ilike(pattern),
                Menu.path.ilike(pattern),
            )
        )
    return list(session.scalars(stmt).all())


def get_menu_or_404(session: Session, menu_id: int) -> Menu:
    menu = session.scalar(select(Menu).where(Menu.id == menu_id))
    if menu is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Menu not found.')
    return menu


def _ensure_unique_path(session: Session, path: str, except_id: int | None = None) -> None:
    stmt = select(Menu).where(Menu.path == path)
    if except_id is not None:
        stmt = stmt.where(Menu.id != except_id)
    if session.scalar(stmt) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f'Path "{path}" is already used by another menu.',
        )


def _child_count(session: Session, menu_id: int) -> int:
    stmt = select(func.count(Menu.id)).where(Menu.parent_id == menu_id)
    return int(session.scalar(stmt) or 0)


def _resolve_parent(session: Session, parent_id: int | None, self_id: int | None = None) -> Menu | None:
    """Validate optional parent_id (max 1 level of sub-menu, no cycles)."""
    if parent_id is None:
        return None
    if self_id is not None and parent_id == self_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='A menu cannot be its own parent.')

    parent = session.scalar(select(Menu).where(Menu.id == parent_id))
    if parent is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Parent menu not found.')
    if parent.parent_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Sub-menus can only be nested one level under a top-level menu.',
        )
    if self_id is not None and _child_count(session, self_id) > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='A menu that already has sub-menus cannot become a sub-menu.',
        )
    return parent


def create_menu(session: Session, actor_id: int, payload: MenuCreate) -> Menu:
    """Create a new top-level menu or sub-menu in PostgreSQL."""
    if session.scalar(select(Menu).where(Menu.code == payload.code)) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f'Menu code "{payload.code}" already exists.')
    _ensure_unique_path(session, payload.path)

    parent = _resolve_parent(session, payload.parent_id)
    group_name = parent.group_name if parent is not None else payload.group_name

    menu = Menu(
        code=payload.code,
        name=payload.name,
        group_name=group_name,
        icon=payload.icon,
        path=payload.path,
        parent_id=parent.id if parent else None,
        sort_order=payload.sort_order,
        is_active=payload.is_active,
    )
    session.add(menu)
    session.flush()
    record_audit(
        session,
        actor_user_id=actor_id,
        action='menu.created',
        target=menu.code,
        detail={'name': menu.name, 'path': menu.path, 'parent_id': menu.parent_id},
    )
    session.commit()
    session.refresh(menu)
    return menu


def update_menu(session: Session, actor_id: int, menu_id: int, payload: MenuUpdate) -> Menu:
    """Update an existing menu. `code` stays fixed so user permissions remain intact."""
    menu = get_menu_or_404(session, menu_id)
    _ensure_unique_path(session, payload.path, except_id=menu_id)

    if menu.code in PROTECTED_MENU_CODES:
        if not payload.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f'Core administration menu "{menu.name}" cannot be deactivated.',
            )
        if payload.parent_id is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f'Core administration menu "{menu.name}" must stay a top-level menu.',
            )

    parent = _resolve_parent(session, payload.parent_id, self_id=menu_id)
    group_name = parent.group_name if parent is not None else payload.group_name

    menu.name = payload.name
    menu.group_name = group_name
    menu.icon = payload.icon
    menu.path = payload.path
    menu.parent_id = parent.id if parent else None
    menu.sort_order = payload.sort_order
    menu.is_active = payload.is_active

    # Keep children in the same sidebar group when a parent's group changes
    if menu.parent_id is None:
        children = list(session.scalars(select(Menu).where(Menu.parent_id == menu.id)).all())
        for child in children:
            child.group_name = group_name

    record_audit(
        session,
        actor_user_id=actor_id,
        action='menu.updated',
        target=menu.code,
        detail={'name': menu.name, 'path': menu.path, 'parent_id': menu.parent_id, 'is_active': menu.is_active},
    )
    session.commit()
    session.refresh(menu)
    return menu


def toggle_menu_active(session: Session, actor_id: int, menu_id: int) -> Menu:
    """Toggle active status of a menu (protected menus cannot be deactivated)."""
    menu = get_menu_or_404(session, menu_id)
    if menu.is_active and menu.code in PROTECTED_MENU_CODES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f'Core administration menu "{menu.name}" cannot be deactivated.',
        )

    menu.is_active = not menu.is_active
    record_audit(
        session,
        actor_user_id=actor_id,
        action='menu.updated',
        target=menu.code,
        detail={'is_active': menu.is_active},
    )
    session.commit()
    session.refresh(menu)
    return menu


def delete_menu(session: Session, actor_id: int, menu_id: int) -> str:
    """Delete a non-core menu without sub-menus and cascade-remove its permission rows."""
    menu = get_menu_or_404(session, menu_id)
    if menu.code in PROTECTED_MENU_CODES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f'Core administration menu "{menu.name}" cannot be deleted.',
        )
    if _child_count(session, menu_id) > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f'Menu "{menu.name}" still has sub-menus. Delete or reassign them first.',
        )
    code = menu.code
    session.delete(menu)
    record_audit(session, actor_user_id=actor_id, action='menu.deleted', target=code)
    session.commit()
    return code
