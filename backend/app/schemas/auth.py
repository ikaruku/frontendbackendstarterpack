"""Pydantic schemas for authentication endpoints."""

from pydantic import BaseModel, Field

from app.schemas.user import UserOut


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=50)
    password: str = Field(min_length=1, max_length=255)


class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = 'bearer'
    user: UserOut


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=255)
    new_password: str = Field(min_length=8, max_length=255)


class MessageResponse(BaseModel):
    message: str
