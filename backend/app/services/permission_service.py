"""Menu catalog and per-user menu permission business logic."""

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.deps import has_permission
from app.models import AccessLevel, Menu, User, UserMenuPermission
from app.schemas.user import UserOut
from app.services.audit_service import record_audit


def user_permissions_dict(user: User) -> dict[str, AccessLevel]:
    """Build {menu_code: AccessLevel} from loaded permissions."""
    if user.is_superadmin:
        return {}
    result: dict[str, AccessLevel] = {}
    for perm in user.permissions:
        if perm.menu and perm.menu.is_active:
            result[perm.menu.code] = perm.access_level
    return result


def to_user_out(user: User) -> UserOut:
    """Convert a User ORM instance to API output schema."""
    return UserOut(
        id=user.id,
        username=user.username,
        full_name=user.full_name,
        email=user.email,
        is_active=user.is_active,
        is_superadmin=user.is_superadmin,
        must_change_password=user.must_change_password,
        permissions=user_permissions_dict(user),
        last_login_at=user.last_login_at,
        created_at=user.created_at,
    )


def list_active_menus(session: Session) -> list[Menu]:
    """Return all active menus ordered for display, excluding sub-menus whose parent is inactive."""
    stmt = select(Menu).where(Menu.is_active.is_(True)).order_by(Menu.sort_order.asc(), Menu.id.asc())
    active = list(session.scalars(stmt).all())
    active_ids = {m.id for m in active}
    return [m for m in active if m.parent_id is None or m.parent_id in active_ids]


def list_accessible_menus(session: Session, user: User) -> list[Menu]:
    """Return active menus the current user can access (plus parent containers for accessible sub-menus)."""
    menus = list_active_menus(session)
    if user.is_superadmin:
        return menus

    accessible = [menu for menu in menus if has_permission(user, menu.code, 'read')]
    needed_parent_ids = {m.parent_id for m in accessible if m.parent_id is not None}
    accessible_ids = {m.id for m in accessible}
    return [m for m in menus if m.id in accessible_ids or m.id in needed_parent_ids]


def update_user_permissions(
    session: Session,
    actor_id: int,
    user_id: int,
    permissions: dict[str, AccessLevel],
) -> User:
    """Replace a user's menu permissions after validating menu codes."""
    stmt = (
        select(User)
        .where(User.id == user_id)
        .options(selectinload(User.permissions).selectinload(UserMenuPermission.menu))
    )
    target = session.scalar(stmt)
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='User not found.')
    if target.is_superadmin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Superadmin permissions cannot be restricted.',
        )

    menus = list_active_menus(session)
    menu_by_code = {menu.code: menu for menu in menus}
    unknown = sorted(set(permissions.keys()) - set(menu_by_code.keys()))
    if unknown:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f'Unknown menu code(s): {", ".join(unknown)}',
        )

    target.permissions.clear()
    session.flush()
    for code, level in permissions.items():
        target.permissions.append(
            UserMenuPermission(menu_id=menu_by_code[code].id, access_level=level)
        )

    record_audit(
        session,
        actor_user_id=actor_id,
        action='permission.changed',
        target=target.username,
        detail={'permissions': {k: v.value for k, v in permissions.items()}},
    )
    session.commit()
    session.refresh(target)
    return session.scalar(stmt)  # reload with menu relationships
