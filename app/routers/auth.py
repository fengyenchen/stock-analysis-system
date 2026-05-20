import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_active_user
from app.limiter import conditional_limit
from app.models import PasswordResetToken, TokenBlacklist, User
from app.schemas import (
    ChangePasswordRequest,
    LoginRequest,
    PasswordResetConfirm,
    PasswordResetRequestCreate,
    RefreshRequest,
    TokenPair,
    UserCreate,
    UserRead,
    UserUpdate,
)
from app.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_password_hash,
    verify_password,
)

router = APIRouter(tags=["Authentication"])


@router.post("/users", response_model=UserRead, status_code=status.HTTP_201_CREATED)
@conditional_limit("5/minute")
def register(request: Request, user_in: UserCreate, db: Session = Depends(get_db)):
    # Check existing username
    existing_user = db.query(User).filter(User.username == user_in.username).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already registered",
        )

    # Check existing email
    existing_email = db.query(User).filter(User.email == user_in.email).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    user = User(
        username=user_in.username,
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return user


@router.post("/sessions", response_model=TokenPair)
@conditional_limit("10/minute")
def login(request: Request, credentials: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == credentials.username).first()
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )

    access_token = create_access_token(user_id=user.id, role=user.role)
    refresh_token = create_refresh_token(user_id=user.id, role=user.role)

    return TokenPair(access_token=access_token, refresh_token=refresh_token)


@router.delete("/sessions/current", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    token: str = Depends(OAuth2PasswordBearer(tokenUrl="/api/v1/sessions")),
    db: Session = Depends(get_db),
):
    payload = decode_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )

    jti = payload.get("jti")
    exp_timestamp = payload.get("exp")

    if jti is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token missing JTI",
        )

    # Check if already blacklisted (idempotent)
    existing = db.query(TokenBlacklist).filter(TokenBlacklist.token_jti == jti).first()
    if existing:
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    expires_at = datetime.now(timezone.utc) + timedelta(days=1)
    if exp_timestamp:
        try:
            expires_at = datetime.fromtimestamp(exp_timestamp, tz=timezone.utc)
        except (ValueError, OSError):
            pass

    blacklist_entry = TokenBlacklist(token_jti=jti, expires_at=expires_at)
    db.add(blacklist_entry)
    db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/token-refreshes", response_model=TokenPair)
@conditional_limit("10/minute")
def refresh(request: Request, request_data: RefreshRequest, db: Session = Depends(get_db)):
    payload = decode_token(request_data.refresh_token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    user_id = payload.get("sub")
    jti = payload.get("jti")
    token_type = payload.get("type")

    if user_id is None or jti is None or token_type != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    # Check blacklist
    blacklisted = db.query(TokenBlacklist).filter(TokenBlacklist.token_jti == jti).first()
    if blacklisted:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has been revoked",
        )

    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    # Rotate refresh token: blacklist old one, issue new pair
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
    exp_timestamp = payload.get("exp")
    if exp_timestamp:
        try:
            expires_at = datetime.fromtimestamp(exp_timestamp, tz=timezone.utc)
        except (ValueError, OSError):
            pass

    blacklist_entry = TokenBlacklist(token_jti=jti, expires_at=expires_at)
    db.add(blacklist_entry)

    new_access_token = create_access_token(user_id=user.id, role=user.role)
    new_refresh_token = create_refresh_token(user_id=user.id, role=user.role)

    db.commit()

    return TokenPair(access_token=new_access_token, refresh_token=new_refresh_token)


@router.get("/users/me", response_model=UserRead)
def get_me(current_user: User = Depends(get_current_active_user)):
    return current_user


@router.patch("/users/me", response_model=UserRead)
def update_me(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    if user_update.username is not None and user_update.username != current_user.username:
        existing = db.query(User).filter(User.username == user_update.username).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Username already taken",
            )
        current_user.username = user_update.username

    if user_update.email is not None and user_update.email != current_user.email:
        existing = db.query(User).filter(User.email == user_update.email).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered",
            )
        current_user.email = user_update.email

    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/users/me/change-password", status_code=status.HTTP_200_OK)
def change_password(
    request_data: ChangePasswordRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    if not verify_password(request_data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    current_user.hashed_password = get_password_hash(request_data.new_password)
    db.commit()
    return {"detail": "Password updated successfully"}


@router.post("/password-reset-requests", status_code=status.HTTP_200_OK)
@conditional_limit("3/minute")
def request_password_reset(request: Request, body: PasswordResetRequestCreate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if user:
        plain_token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(plain_token.encode()).hexdigest()
        expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
        reset_token = PasswordResetToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=expires_at,
        )
        db.add(reset_token)
        db.commit()
        # TODO: send email with reset link containing plain_token
        print(f"[PASSWORD RESET] token for {user.email}: {plain_token}")
    # Always return 200 to avoid user enumeration
    return {"detail": "If that email is registered, a reset link has been sent."}


@router.post("/password-resets", status_code=status.HTTP_200_OK)
@conditional_limit("5/minute")
def reset_password(request: Request, body: PasswordResetConfirm, db: Session = Depends(get_db)):
    token_hash = hashlib.sha256(body.token.encode()).hexdigest()
    reset_token = db.query(PasswordResetToken).filter(
        PasswordResetToken.token_hash == token_hash
    ).first()

    if reset_token is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token.",
        )

    now = datetime.now(timezone.utc)
    # SQLite returns naive datetimes; normalise for comparison
    expires_at = reset_token.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at < now or reset_token.used_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token.",
        )

    reset_token.user.hashed_password = get_password_hash(body.new_password)
    reset_token.used_at = now
    db.commit()
    return {"detail": "Password updated."}
