"""Pydantic schemas for users, menus, permissions, and audit logs."""

from datetime import datetime
import re

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.menu import AccessLevel

USERNAME_RE = re.compile(r'^[a-zA-Z0-9._-]{3,50}$')
EMAIL_RE = re.compile(r'^\S+@\S+\.\S+$')


class UserOut(BaseModel):
    id: int
    username: str
    full_name: str
    email: str | None
    is_active: bool
    is_superadmin: bool
    must_change_password: bool
    permissions: dict[str, AccessLevel]
    last_login_at: datetime | None
    created_at: datetime


class UserBase(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    full_name: str = Field(min_length=1, max_length=120)
    email: str | None = Field(default=None, max_length=255)
    is_active: bool = True

    @field_validator('username')
    @classmethod
    def check_username(cls, value: str) -> str:
        cleaned = value.strip()
        if not USERNAME_RE.match(cleaned):
            raise ValueError('Username must be 3-50 chars (letters, numbers, dot, dash, underscore).')
        return cleaned

    @field_validator('full_name')
    @classmethod
    def check_full_name(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError('Full name is required.')
        return cleaned

    @field_validator('email')
    @classmethod
    def check_email(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        if not cleaned:
            return None
        if not EMAIL_RE.match(cleaned):
            raise ValueError('Invalid email address format.')
        return cleaned


class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=255)


class UserUpdate(UserBase):
    pass


class UserPermissionsUpdate(BaseModel):
    permissions: dict[str, AccessLevel]


class ResetPasswordResponse(BaseModel):
    user_id: int
    temporary_password: str


class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    actor_user_id: int | None
    action: str
    target: str | None
    detail: dict | None
    created_at: datetime
