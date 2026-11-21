"""Menus and per-user menu permissions (Read / Write)."""

import enum

from sqlalchemy import Boolean, Enum, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class AccessLevel(str, enum.Enum):
    """`write` includes `read`. No row = no access."""

    read = 'read'
    write = 'write'


class Menu(Base):
    __tablename__ = 'menus'

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True)  # permission key, never change
    name: Mapped[str] = mapped_column(String(80))
    group_name: Mapped[str] = mapped_column(String(80), default='Main Menu')
    icon: Mapped[str] = mapped_column(String(50))
    path: Mapped[str] = mapped_column(String(120))
    parent_id: Mapped[int | None] = mapped_column(ForeignKey('menus.id', ondelete='SET NULL'))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class UserMenuPermission(Base):
    __tablename__ = 'user_menu_permissions'
    __table_args__ = (UniqueConstraint('user_id', 'menu_id', name='uq_user_menu'),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    menu_id: Mapped[int] = mapped_column(ForeignKey('menus.id', ondelete='CASCADE'))
    access_level: Mapped[AccessLevel] = mapped_column(Enum(AccessLevel, name='access_level'))

    user: Mapped['User'] = relationship(back_populates='permissions')  # noqa: F821
    menu: Mapped['Menu'] = relationship()
