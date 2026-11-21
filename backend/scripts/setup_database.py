"""One-time database setup. Uses only the Python standard library.

What it does (safe to run many times):
  1. Creates backend/.env and backend/.env.admin with random secrets (only if missing).
  2. Installs PostgreSQL with winget if `psql` is not found (Windows).
  3. Creates the least-privilege application role and the database.

Run from the backend folder:
    python scripts/setup_database.py

Secrets never print to the screen. Files are hidden and restricted to your Windows user.
"""

import getpass
import glob
import os
import secrets
import subprocess
import sys
import time
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = BACKEND_DIR / '.env'  # used by the app (least privilege)
ADMIN_FILE = BACKEND_DIR / '.env.admin'  # PostgreSQL superuser, ONLY used by this script

DB_NAME = 'flexadmin'
DB_USER = 'flexadmin_app'
DB_HOST = 'localhost'
DB_PORT = '5432'
PG_WINGET_ID = 'PostgreSQL.PostgreSQL.16'


def new_secret(nbytes: int = 24) -> str:
    """Random URL-safe secret without quotes or symbols that break shells/SQL."""
    return secrets.token_urlsafe(nbytes).replace('-', 'x').replace('_', 'y')


def read_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if path.exists():
        for line in path.read_text(encoding='utf-8').splitlines():
            if line.strip() and not line.startswith('#') and '=' in line:
                key, _, value = line.partition('=')
                values[key.strip()] = value.strip()
    return values


def lock_file(path: Path) -> None:
    """Restrict the file to the current Windows user and mark it hidden."""
    if os.name != 'nt':
        path.chmod(0o600)
        return
    user = os.environ.get('USERNAME', '')
    subprocess.run(['icacls', str(path), '/inheritance:r', '/grant:r', f'{user}:(R,W)'], check=True, capture_output=True)
    subprocess.run(['attrib', '+H', str(path)], check=True, capture_output=True)


def write_secret_file(path: Path, content: str) -> None:
    if path.exists() and os.name == 'nt':
        subprocess.run(['attrib', '-H', str(path)], capture_output=True)  # hidden files cannot be overwritten
    path.write_text(content, encoding='utf-8')
    lock_file(path)


def ensure_secret_files() -> tuple[dict[str, str], dict[str, str]]:
    admin = read_env(ADMIN_FILE)
    if 'POSTGRES_SUPERUSER_PASSWORD' not in admin:
        admin = {
            'POSTGRES_SUPERUSER': 'postgres',
            'POSTGRES_SUPERUSER_PASSWORD': new_secret(),
        }
        body = '# PostgreSQL superuser. Used ONLY by scripts/setup_database.py. Never commit.\n'
        body += ''.join(f'{k}={v}\n' for k, v in admin.items())
        write_secret_file(ADMIN_FILE, body)
        print('Created backend/.env.admin (hidden, owner only).')

    env = read_env(ENV_FILE)
    if 'POSTGRES_PASSWORD' not in env:
        env = {
            'POSTGRES_HOST': DB_HOST,
            'POSTGRES_PORT': DB_PORT,
            'POSTGRES_DB': DB_NAME,
            'POSTGRES_USER': DB_USER,
            'POSTGRES_PASSWORD': new_secret(),
            'JWT_SECRET': new_secret(48),
            'JWT_ALGORITHM': 'HS256',
            'ACCESS_TOKEN_MINUTES': '15',
            'REFRESH_TOKEN_DAYS': '7',
            'ADMIN_USERNAME': 'admin',
            'ADMIN_FULL_NAME': 'Administrator',
            'ADMIN_EMAIL': 'admin@example.com',
            'ADMIN_DEFAULT_PASSWORD': 'Fx1!' + new_secret(12),
        }
        body = '# Application settings and secrets. Never commit this file.\n'
        body += ''.join(f'{k}={v}\n' for k, v in env.items())
        write_secret_file(ENV_FILE, body)
        print('Created backend/.env (hidden, owner only).')
    return env, admin


def find_psql() -> str | None:
    matches = sorted(glob.glob(r'C:\Program Files\PostgreSQL\*\bin\psql.exe'), reverse=True)
    return matches[0] if matches else None


def install_postgres(superuser_password: str) -> None:
    print('PostgreSQL not found. Installing with winget (a Windows permission prompt may appear)...')
    override = f'--mode unattended --unattendedmodeui none --superpassword {superuser_password} --serverport {DB_PORT}'
    subprocess.run(
        ['winget', 'install', '-e', '--id', PG_WINGET_ID, '--silent',
         '--accept-source-agreements', '--accept-package-agreements', '--override', override],
        check=True,
    )


def run_psql(psql: str, password: str, args: list[str]) -> subprocess.CompletedProcess:
    env = {**os.environ, 'PGPASSWORD': password, 'PGCLIENTENCODING': 'UTF8'}
    return subprocess.run(
        [psql, '-h', DB_HOST, '-p', DB_PORT, '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', *args],
        env=env, capture_output=True, text=True,
    )


def wait_for_server(psql: str, password: str) -> None:
    for _ in range(30):
        if run_psql(psql, password, ['-d', 'postgres', '-c', 'SELECT 1']).returncode == 0:
            return
        time.sleep(2)
    sys.exit('Cannot connect to PostgreSQL as superuser. Check that the service is running on port ' + DB_PORT)


def provision(psql: str, admin_pw: str, app_pw: str) -> None:
    """Create the app role and database, and lock the database down."""
    role_sql = (
        "DO $$ BEGIN "
        f"IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '{DB_USER}') THEN "
        f"CREATE ROLE {DB_USER} LOGIN PASSWORD '{app_pw}' NOSUPERUSER NOCREATEDB NOCREATEROLE; "
        f"ELSE ALTER ROLE {DB_USER} LOGIN PASSWORD '{app_pw}'; END IF; END $$;"
    )
    # `\gexec` only works from a script file, so write the steps into a temporary SQL file.
    sql_file = BACKEND_DIR / '.provision.tmp.sql'
    sql_file.write_text(
        f"{role_sql}\n"
        f"SELECT 'CREATE DATABASE {DB_NAME} OWNER {DB_USER}' WHERE NOT EXISTS "
        f"(SELECT FROM pg_database WHERE datname = '{DB_NAME}')\\gexec\n"
        f"REVOKE ALL ON DATABASE {DB_NAME} FROM PUBLIC;\n"
        f"GRANT CONNECT ON DATABASE {DB_NAME} TO {DB_USER};\n",
        encoding='utf-8',
    )
    try:
        result = run_psql(psql, admin_pw, ['-d', 'postgres', '-f', str(sql_file)])
    finally:
        sql_file.unlink(missing_ok=True)  # the file contains the app password
    if result.returncode != 0:
        sys.exit('Provisioning failed:\n' + result.stderr.replace(app_pw, '***'))


def main() -> None:
    env, admin = ensure_secret_files()
    admin_pw = admin['POSTGRES_SUPERUSER_PASSWORD']

    psql = find_psql()
    if psql is None:
        install_postgres(admin_pw)
        psql = find_psql()
        if psql is None:
            sys.exit('PostgreSQL installation did not finish. Install it manually, then run this script again.')
    else:
        print(f'Found PostgreSQL: {psql}')

    wait_for_server(psql, admin_pw)
    provision(psql, admin_pw, env['POSTGRES_PASSWORD'])
    print(f"Database '{DB_NAME}' and role '{DB_USER}' are ready.")
    print('Next: python -m venv .venv  ->  pip install -r requirements.txt  ->  alembic upgrade head  ->  python -m app.seed')


if __name__ == '__main__':
    main()
