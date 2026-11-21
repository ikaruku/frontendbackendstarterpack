"""Application settings, read from environment variables / backend/.env."""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / '.env', extra='ignore')

    postgres_host: str = 'localhost'
    postgres_port: int = 5432
    postgres_db: str
    postgres_user: str
    postgres_password: str

    jwt_secret: str
    jwt_algorithm: str = 'HS256'
    access_token_minutes: int = 15
    refresh_token_days: int = 7

    cookie_secure: bool = False
    refresh_cookie_name: str = 'admin_panel_refresh'
    cors_origins: str = 'http://localhost:5173,http://127.0.0.1:5173'
    login_rate_limit_max: int = 5
    login_rate_limit_window_seconds: int = 60

    admin_username: str = 'admin'
    admin_full_name: str = 'Administrator'
    admin_email: str = ''
    admin_default_password: str

    @property
    def database_url(self) -> str:
        """Built from parts so the password never appears in a committed file."""
        return (
            f'postgresql+psycopg://{self.postgres_user}:{self.postgres_password}'
            f'@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}'
        )

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(',') if origin.strip()]


settings = Settings()
