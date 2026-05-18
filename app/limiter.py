from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import settings

limiter = Limiter(key_func=get_remote_address)


def conditional_limit(*args, **kwargs):
    """Apply rate limit only outside of test environment."""
    def decorator(func):
        if settings.environment == "test":
            return func
        return limiter.limit(*args, **kwargs)(func)
    return decorator
