"""Authentication routes: login, token refresh, logout, profile, and password change."""

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_user
from app.core.rate_limit import login_limiter
from app.db.session import get_session
from app.models import User
from app.schemas.auth import AuthTokenResponse, ChangePasswordRequest, LoginRequest, MessageResponse
from app.schemas.user import UserOut
from app.services.auth_service import authenticate_user, change_user_password, logout_session, refresh_session
from app.services.permission_service import to_user_out

router = APIRouter(prefix='/api/auth', tags=['Auth'])


def _set_refresh_cookie(response: Response, raw_refresh: str) -> None:
    response.set_cookie(
        key=settings.refresh_cookie_name,
        value=raw_refresh,
        httponly=True,
        samesite='lax',
        secure=settings.cookie_secure,
        max_age=settings.refresh_token_days * 24 * 60 * 60,
        path='/api/auth',
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.refresh_cookie_name,
        httponly=True,
        samesite='lax',
        secure=settings.cookie_secure,
        path='/api/auth',
    )


@router.post('/login', response_model=AuthTokenResponse)
def login(payload: LoginRequest, request: Request, response: Response, session: Session = Depends(get_session)) -> AuthTokenResponse:
    client_ip = request.client.host if request.client else 'unknown'
    login_limiter.check(client_ip)
    try:
        user, access_token, raw_refresh = authenticate_user(session, payload.username, payload.password)
    except HTTPException:
        login_limiter.record_failure(client_ip)
        raise
    login_limiter.reset(client_ip)
    _set_refresh_cookie(response, raw_refresh)
    return AuthTokenResponse(access_token=access_token, user=to_user_out(user))


@router.post('/refresh', response_model=AuthTokenResponse)
def refresh(request: Request, response: Response, session: Session = Depends(get_session)) -> AuthTokenResponse:
    raw_refresh = request.cookies.get(settings.refresh_cookie_name)
    user, access_token, new_refresh = refresh_session(session, raw_refresh)
    _set_refresh_cookie(response, new_refresh)
    return AuthTokenResponse(access_token=access_token, user=to_user_out(user))


@router.post('/logout', response_model=MessageResponse)
def logout(request: Request, response: Response, session: Session = Depends(get_session)) -> MessageResponse:
    raw_refresh = request.cookies.get(settings.refresh_cookie_name)
    logout_session(session, raw_refresh)
    _clear_refresh_cookie(response)
    return MessageResponse(message='Logged out successfully.')


@router.get('/me', response_model=UserOut)
def me(current_user: User = Depends(get_current_user)) -> UserOut:
    return to_user_out(current_user)


@router.post('/change-password', response_model=AuthTokenResponse)
def change_password(
    payload: ChangePasswordRequest,
    response: Response,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> AuthTokenResponse:
    user, access_token, raw_refresh = change_user_password(
        session, current_user, payload.current_password, payload.new_password
    )
    _set_refresh_cookie(response, raw_refresh)
    return AuthTokenResponse(access_token=access_token, user=to_user_out(user))
