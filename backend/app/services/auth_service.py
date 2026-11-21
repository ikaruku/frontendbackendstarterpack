"""Authentication business logic: login, refresh token rotation, logout, password change."""

from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.core.security import (
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_token,
    validate_password_strength,
    verify_password,
)
from app.models import RefreshToken, User, UserMenuPermission
from app.services.audit_service import record_audit


def _load_user_by_username(session: Session, username: str) -> User | None:
    stmt = (
        select(User)
        .where(User.username.ilike(username.strip()))
        .options(selectinload(User.permissions).selectinload(UserMenuPermission.menu))
    )
    return session.scalar(stmt)


def _issue_tokens(session: Session, user: User) -> tuple[str, str]:
    access_token = create_access_token(user.id)
    raw_refresh = generate_refresh_token()
    expires_at = datetime.now(UTC) + timedelta(days=settings.refresh_token_days)
    session.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_token(raw_refresh),
            expires_at=expires_at,
        )
    )
    return access_token, raw_refresh


def revoke_user_refresh_tokens(session: Session, user_id: int) -> None:
    """Revoke all active refresh tokens belonging to a user."""
    now = datetime.now(UTC)
    session.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=now)
    )


def authenticate_user(session: Session, username: str, password: str) -> tuple[User, str, str]:
    """Verify credentials and return (user, access_token, raw_refresh_token)."""
    user = _load_user_by_username(session, username)
    if user is None or not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Incorrect username or password.',
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail='This account is deactivated. Contact an administrator.',
        )

    user.last_login_at = datetime.now(UTC)
    access_token, raw_refresh = _issue_tokens(session, user)
    record_audit(session, actor_user_id=user.id, action='auth.login', target=user.username)
    session.commit()
    return user, access_token, raw_refresh


def refresh_session(session: Session, raw_refresh_token: str | None) -> tuple[User, str, str]:
    """Rotate a valid refresh token and issue a fresh access token."""
    if not raw_refresh_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Refresh token missing.')

    token_row = session.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == hash_token(raw_refresh_token))
    )
    now = datetime.now(UTC)
    if token_row is None or token_row.revoked_at is not None or token_row.expires_at <= now:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid or expired refresh token.')

    user = session.scalar(
        select(User)
        .where(User.id == token_row.user_id, User.is_active.is_(True))
        .options(selectinload(User.permissions).selectinload(UserMenuPermission.menu))
    )
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Account is inactive.')

    token_row.revoked_at = now
    access_token, new_refresh = _issue_tokens(session, user)
    session.commit()
    return user, access_token, new_refresh


def logout_session(session: Session, raw_refresh_token: str | None) -> None:
    """Revoke the provided refresh token if it exists."""
    if not raw_refresh_token:
        return
    token_row = session.scalar(
        select(RefreshToken).where(
            RefreshToken.token_hash == hash_token(raw_refresh_token),
            RefreshToken.revoked_at.is_(None),
        )
    )
    if token_row is not None:
        token_row.revoked_at = datetime.now(UTC)
        session.commit()


def change_user_password(
    session: Session, user: User, current_password: str, new_password: str
) -> tuple[User, str, str]:
    """Validate old password, enforce policy, update hash, and rotate tokens."""
    if not verify_password(current_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Current password is incorrect.')
    if current_password == new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='New password must be different from current password.',
        )
    strength_error = validate_password_strength(new_password)
    if strength_error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=strength_error)

    user.password_hash = hash_password(new_password)
    user.must_change_password = False
    revoke_user_refresh_tokens(session, user.id)
    access_token, raw_refresh = _issue_tokens(session, user)
    record_audit(session, actor_user_id=user.id, action='auth.password_changed', target=user.username)
    session.commit()
    return user, access_token, raw_refresh
