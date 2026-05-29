from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import settings
from app.security import decode_token

limiter = Limiter(key_func=get_remote_address)


def conditional_limit(*args, **kwargs):
    """Apply rate limit only outside of test environment."""
    def decorator(func):
        if settings.environment == "test":
            return func
        return limiter.limit(*args, **kwargs)(func)
    return decorator


def get_authenticated_subject_or_address(request):
    """Use authenticated user identity for rate limits when a bearer token is valid."""
    authorization = request.headers.get("Authorization", "")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() == "bearer" and token:
        payload = decode_token(token)
        if payload and payload.get("sub"):
            return f"user:{payload['sub']}"
    return get_remote_address(request)
