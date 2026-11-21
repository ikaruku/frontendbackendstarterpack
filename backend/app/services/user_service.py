"""User CRUD and admin safety guards business logic."""

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.security import generate_temporary_password, hash_password, validate_password_strength
from app.models import User, UserMenuPermission
from app.schemas.user import UserCreate, UserUpdate
from app.services.audit_service import record_audit
from app.services.auth_service import revoke_user_refresh_tokens


def _user_query():
    return select(User).options(selectinload(User.permissions).selectinload(UserMenuPermission.menu))


def _active_superadmin_count(session: Session) -> int:
    stmt = select(func.count(User.id)).where(User.is_superadmin.is_(True), User.is_active.is_(True))
    return int(session.scalar(stmt) or 0)


def _ensure_not_self_or_last_admin(session: Session, actor_id: int, target: User, action_verb: str) -> None:
    if target.id == actor_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f'You cannot {action_verb} your own account.',
        )
    if target.is_superadmin and target.is_active and _active_superadmin_count(session) <= 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f'The last active administrator cannot be {action_verb}d.',
        )


def list_users(session: Session, search: str | None = None, is_active: bool | None = None) -> list[User]:
    """List users with optional search and status filter."""
    stmt = _user_query().order_by(User.id.asc())
    if is_active is not None:
        stmt = stmt.where(User.is_active.is_(is_active))
    if search and search.strip():
        pattern = f'%{search.strip()}%'
        stmt = stmt.where(
            or_(
                User.username.ilike(pattern),
                User.full_name.ilike(pattern),
                User.email.ilike(pattern),
            )
        )
    return list(session.scalars(stmt).all())


def get_user_or_404(session: Session, user_id: int) -> User:
    user = session.scalar(_user_query().where(User.id == user_id))
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='User not found.')
    return user


def create_user(session: Session, actor_id: int, payload: UserCreate) -> User:
    """Create a new non-superadmin user with argon2 password hash."""
    existing = session.scalar(select(User).where(User.username.ilike(payload.username)))
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail='Username is already taken.')

    strength_error = validate_password_strength(payload.password)
    if strength_error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=strength_error)

    user = User(
        username=payload.username,
        full_name=payload.full_name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        is_active=payload.is_active,
        is_superadmin=False,
        must_change_password=True,
    )
    session.add(user)
    session.flush()
    record_audit(
        session,
        actor_user_id=actor_id,
        action='user.created',
        target=user.username,
        detail={'is_active': user.is_active},
    )
    session.commit()
    return get_user_or_404(session, user.id)


def update_user(session: Session, actor_id: int, user_id: int, payload: UserUpdate) -> tuple[User, bool]:
    """Update user profile/status; returns (updated_user, became_inactive)."""
    target = get_user_or_404(session, user_id)

    duplicate = session.scalar(
        select(User).where(User.id != user_id, User.username.ilike(payload.username))
    )
    if duplicate is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail='Username is already taken.')

    became_inactive = target.is_active and not payload.is_active
    if became_inactive:
        _ensure_not_self_or_last_admin(session, actor_id, target, 'deactivate')

    target.username = payload.username
    target.full_name = payload.full_name
    target.email = payload.email
    target.is_active = payload.is_active

    if became_inactive:
        revoke_user_refresh_tokens(session, target.id)

    record_audit(
        session,
        actor_user_id=actor_id,
        action='user.deactivated' if became_inactive else 'user.updated',
        target=target.username,
        detail={'is_active': target.is_active},
    )
    session.commit()
    return get_user_or_404(session, target.id), became_inactive


def toggle_user_active(session: Session, actor_id: int, user_id: int) -> User:
    """Toggle a user's active status with admin protection."""
    target = get_user_or_404(session, user_id)
    if target.is_active:
        _ensure_not_self_or_last_admin(session, actor_id, target, 'deactivate')

    target.is_active = not target.is_active
    if not target.is_active:
        revoke_user_refresh_tokens(session, target.id)

    record_audit(
        session,
        actor_user_id=actor_id,
        action='user.updated' if target.is_active else 'user.deactivated',
        target=target.username,
        detail={'is_active': target.is_active},
    )
    session.commit()
    return get_user_or_404(session, target.id)


def delete_user(session: Session, actor_id: int, user_id: int) -> str:
    """Delete a user account after admin safety checks."""
    target = get_user_or_404(session, user_id)
    _ensure_not_self_or_last_admin(session, actor_id, target, 'delete')
    username = target.username
    session.delete(target)
    record_audit(session, actor_user_id=actor_id, action='user.deleted', target=username)
    session.commit()
    return username


def reset_user_password(session: Session, actor_id: int, user_id: int) -> tuple[User, str]:
    """Set a random temporary password and force password change on next login."""
    target = get_user_or_404(session, user_id)
    temp_password = generate_temporary_password()
    target.password_hash = hash_password(temp_password)
    target.must_change_password = True
    revoke_user_refresh_tokens(session, target.id)
    record_audit(session, actor_user_id=actor_id, action='user.password_reset', target=target.username)
    session.commit()
    return get_user_or_404(session, target.id), temp_password
