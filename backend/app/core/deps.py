"""FastAPI authentication and menu permission dependencies."""

from typing import Callable, Literal

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.security import decode_access_token
from app.db.session import get_session
from app.models import Menu, User, UserMenuPermission

bearer_scheme = HTTPBearer(auto_error=False)


def load_active_user(session: Session, user_id: int) -> User | None:
    """Fetch an active user along with menu permissions."""
    stmt = (
        select(User)
        .where(User.id == user_id, User.is_active.is_(True))
        .options(selectinload(User.permissions).selectinload(UserMenuPermission.menu))
    )
    return session.scalar(stmt)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    session: Session = Depends(get_session),
) -> User:
    """Validate Bearer JWT and return the active User."""
    if credentials is None or credentials.scheme.lower() != 'bearer':
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Authentication required.',
        )
    user_id = decode_access_token(credentials.credentials)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Invalid or expired access token.',
        )
    user = load_active_user(session, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Session is no longer active.',
        )
    return user


def has_permission(user: User, menu_code: str, level: Literal['read', 'write'] = 'read') -> bool:
    """Return True if user holds the requested access level on `menu_code`."""
    if not user.is_active:
        return False
    if user.is_superadmin:
        return True
    for perm in user.permissions:
        if perm.menu and perm.menu.is_active and perm.menu.code == menu_code:
            if level == 'read':
                return True
            return perm.access_level.value == 'write'
    return False


def require_permission(menu_code: str, level: Literal['read', 'write'] = 'read') -> Callable[[User], User]:
    """Dependency enforcing per-menu Read or Write access on the backend."""

    def _checker(user: User = Depends(get_current_user)) -> User:
        if not has_permission(user, menu_code, level):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f'You do not have {level} permission for "{menu_code}".',
            )
        return user

    return _checker


def get_active_menu_codes(session: Session) -> set[str]:
    """Return all active menu codes from the database."""
    return set(session.scalars(select(Menu.code).where(Menu.is_active.is_(True))).all())
