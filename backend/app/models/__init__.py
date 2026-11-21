"""Import every model here so Alembic can see all tables."""

from app.models.auth import AuditLog, RefreshToken
from app.models.menu import AccessLevel, Menu, UserMenuPermission
from app.models.user import User

__all__ = ['AccessLevel', 'AuditLog', 'Menu', 'RefreshToken', 'User', 'UserMenuPermission']
