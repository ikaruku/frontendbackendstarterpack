"""Lightweight sliding-window rate limiter for login protection."""

from collections import defaultdict, deque
from threading import Lock
import time

from fastapi import HTTPException, status

from app.core.config import settings


class SlidingWindowRateLimiter:
    """Tracks failed login timestamps per key within a rolling window."""

    def __init__(self, max_attempts: int, window_seconds: int) -> None:
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self._attempts: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def _prune(self, bucket: deque[float], now: float) -> None:
        cutoff = now - self.window_seconds
        while bucket and bucket[0] <= cutoff:
            bucket.popleft()

    def check(self, key: str) -> None:
        """Raise HTTP 429 if key has exceeded the allowed failed attempts."""
        now = time.monotonic()
        with self._lock:
            bucket = self._attempts[key]
            self._prune(bucket, now)
            if len(bucket) >= self.max_attempts:
                retry_after = max(1, int(self.window_seconds - (now - bucket[0])))
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail='Too many failed login attempts. Please try again later.',
                    headers={'Retry-After': str(retry_after)},
                )

    def record_failure(self, key: str) -> None:
        """Record a failed attempt timestamp for key."""
        now = time.monotonic()
        with self._lock:
            bucket = self._attempts[key]
            self._prune(bucket, now)
            bucket.append(now)

    def reset(self, key: str) -> None:
        """Clear recorded failures for key after a successful login."""
        with self._lock:
            self._attempts.pop(key, None)

    def clear_all(self) -> None:
        """Reset all tracked keys (useful in automated tests)."""
        with self._lock:
            self._attempts.clear()


login_limiter = SlidingWindowRateLimiter(
    max_attempts=settings.login_rate_limit_max,
    window_seconds=settings.login_rate_limit_window_seconds,
)
