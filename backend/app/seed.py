"""Seed: default menus and the first admin account. Safe to run many times.

Run from the backend folder:  python -m app.seed
"""

from sqlalchemy import delete, select

from app.core.config import settings
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models import Menu, User

# Core default menus. Admins can manage all menus via Menu Management in the UI.
# Never change an existing `code` because permissions are keyed by `menu.code`.
MENUS = [
    {'code': 'dashboard', 'name': 'Dashboard', 'path': '/dashboard', 'icon': 'grid', 'group_name': 'Main Menu'},
    {'code': 'reports', 'name': 'Reports', 'path': '/reports', 'icon': 'file', 'group_name': 'Main Menu'},
    {'code': 'inventory', 'name': 'Inventory', 'path': '/inventory', 'icon': 'box', 'group_name': 'Main Menu'},
    {'code': 'customers', 'name': 'Customers', 'path': '/customers', 'icon': 'contact', 'group_name': 'Main Menu'},
    {'code': 'user_management', 'name': 'User Management', 'path': '/users', 'icon': 'users', 'group_name': 'Administration'},
    {'code': 'menu_management', 'name': 'Menu Management', 'path': '/menus', 'icon': 'layers', 'group_name': 'Administration'},
]


def seed_menus(session) -> None:
    # Remove legacy unused `settings` menu if present from earlier stage
    session.execute(delete(Menu).where(Menu.code == 'settings'))
    for order, data in enumerate(MENUS, start=1):
        menu = session.scalar(select(Menu).where(Menu.code == data['code']))
        if menu is None:
            session.add(Menu(sort_order=order, **data))
        else:  # keep `code`, refresh default display fields
            for key, value in data.items():
                setattr(menu, key, value)
            menu.sort_order = order


def seed_admin(session) -> bool:
    """Create the first admin only if it does not exist. Returns True when created."""
    exists = session.scalar(select(User).where(User.username == settings.admin_username))
    if exists:
        return False
    session.add(
        User(
            username=settings.admin_username,
            full_name=settings.admin_full_name,
            email=settings.admin_email or None,
            password_hash=hash_password(settings.admin_default_password),
            is_active=True,
            is_superadmin=True,
            must_change_password=False,
        )
    )
    return True


def main() -> None:
    with SessionLocal() as session:
        seed_menus(session)
        created = seed_admin(session)
        session.commit()
    print('Menus seeded.')
    print('Admin account created (password is in backend/.env).' if created else 'Admin account already exists.')


if __name__ == '__main__':
    main()
