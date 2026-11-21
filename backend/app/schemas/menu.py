"""Pydantic schemas for menu listing and Menu Management CRUD."""

import re

from pydantic import BaseModel, ConfigDict, Field, field_validator

CODE_RE = re.compile(r'^[a-z][a-z0-9_]{1,49}$')
PATH_RE = re.compile(r'^/[a-z0-9/_-]{1,119}$')
RESERVED_PATHS = {'/login', '/change-password', '/api', '/ws'}


class MenuOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    name: str
    group_name: str
    icon: str
    path: str
    parent_id: int | None
    sort_order: int
    is_active: bool


class MenuBase(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    group_name: str = Field(default='Main Menu', min_length=1, max_length=80)
    icon: str = Field(default='grid', min_length=1, max_length=50)
    path: str = Field(min_length=2, max_length=120)
    parent_id: int | None = None
    sort_order: int = Field(default=10, ge=0, le=9999)
    is_active: bool = True

    @field_validator('name', 'group_name', 'icon')
    @classmethod
    def check_non_empty(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError('Field cannot be empty.')
        return cleaned

    @field_validator('path')
    @classmethod
    def check_path(cls, value: str) -> str:
        cleaned = value.strip().lower()
        if not cleaned.startswith('/'):
            cleaned = '/' + cleaned
        cleaned = cleaned.rstrip('/') or '/'
        if not PATH_RE.match(cleaned):
            raise ValueError('Path must start with "/" and use lowercase letters, numbers, "-" or "/".')
        if cleaned in RESERVED_PATHS or cleaned.startswith('/api/') or cleaned.startswith('/ws/'):
            raise ValueError(f'Path "{cleaned}" is reserved by the system.')
        return cleaned


class MenuCreate(MenuBase):
    code: str = Field(min_length=2, max_length=50)

    @field_validator('code')
    @classmethod
    def check_code(cls, value: str) -> str:
        cleaned = value.strip().lower()
        if not CODE_RE.match(cleaned):
            raise ValueError('Code must start with a letter and use 2-50 lowercase letters, numbers, or "_".')
        return cleaned


class MenuUpdate(MenuBase):
    pass
