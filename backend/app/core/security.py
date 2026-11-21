"""Security helpers: argon2 password hashing, JWT access tokens, and opaque refresh tokens."""

from datetime import UTC, datetime, timedelta
import hashlib
import secrets
import string

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
import jwt

from app.core.config import settings

_hasher = PasswordHasher()


def hash_password(plain: str) -> str:
    """Hash a plain password using argon2id."""
    return _hasher.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plain password against an argon2id hash."""
    try:
        return _hasher.verify(hashed, plain)
    except VerifyMismatchError:
        return False


def validate_password_strength(password: str) -> str | None:
    """Return an error message if password violates policy, otherwise None."""
    if len(password) < 8:
        return 'Password must be at least 8 characters long.'
    has_letter = any(ch.isalpha() for ch in password)
    has_digit = any(ch.isdigit() for ch in password)
    if not (has_letter and has_digit):
        return 'Password must contain both letters and numbers.'
    return None


def generate_temporary_password(length: int = 12) -> str:
    """Generate a random temporary password satisfying complexity rules."""
    alphabet = string.ascii_letters + string.digits
    chars = [
        secrets.choice(string.ascii_uppercase),
        secrets.choice(string.ascii_lowercase),
        secrets.choice(string.digits),
        *[secrets.choice(alphabet) for _ in range(max(5, length - 3))],
    ]
    secrets.SystemRandom().shuffle(chars)
    return ''.join(chars)


def create_access_token(user_id: int) -> str:
    """Create a short-lived signed JWT access token."""
    now = datetime.now(UTC)
    payload = {
        'sub': str(user_id),
        'type': 'access',
        'iat': now,
        'exp': now + timedelta(minutes=settings.access_token_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> int | None:
    """Validate an access JWT and return user_id, or None when invalid/expired."""
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError:
        return None
    if payload.get('type') != 'access' or 'sub' not in payload:
        return None
    try:
        return int(payload['sub'])
    except (TypeError, ValueError):
        return None


def generate_refresh_token() -> str:
    """Generate a cryptographically random opaque refresh token."""
    return secrets.token_urlsafe(48)


def hash_token(raw_token: str) -> str:
    """Hash an opaque token with SHA-256 before database storage or lookup."""
    return hashlib.sha256(raw_token.encode('utf-8')).hexdigest()
