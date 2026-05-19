from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_admin
from app.models import ContentVisibility, User
from app.schemas import ContentVisibilityRead, ContentVisibilityUpdate, UserAdminUpdate, UserRead

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/users", response_model=List[UserRead])
def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """List all users (paginated)."""
    users = db.query(User).offset(skip).limit(limit).all()
    return users


@router.get("/users/{user_id}", response_model=UserRead)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Get a single user by ID."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return user


@router.patch("/users/{user_id}", response_model=UserRead)
def update_user(
    user_id: int,
    update: UserAdminUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Update a user's admin-editable fields."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if user.id == current_user.id:
        # Prevent self-demotion or self-deactivation via admin endpoints
        if update.role is not None and update.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot demote yourself from admin",
            )
        if update.is_active is not None and update.is_active is False:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot deactivate your own account",
            )

    if update.is_active is not None:
        user.is_active = update.is_active
    if update.role is not None:
        user.role = update.role

    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Delete a user and all associated data."""
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    db.delete(user)
    db.commit()
    return None


# ─── Content Visibility ──────────────────────────────────

_CONTENT_KEYS = [
    "recommendation_banner",
    "metrics_strip",
    "stock_header",
    "price_chart",
    "technical_indicators",
    "analysis_points",
    "quick_stats_grid",
    "key_metrics_grid",
    "analyst_consensus",
    "related_stocks",
    "financial_health_scores",
    "quick_actions",
    "signal_summary",
    "risk_assessment",
    "support_resistance",
    "peer_comparison",
    "sync_csv_actions",
    "alert_form",
]


@router.get("/content-visibility", response_model=List[ContentVisibilityRead])
def list_content_visibility(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """List all content visibility settings (global + per-user overrides)."""
    return db.query(ContentVisibility).all()


@router.patch("/content-visibility/global/{content_key}", response_model=ContentVisibilityRead)
def set_global_visibility(
    content_key: str,
    update: ContentVisibilityUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Set a global content visibility toggle."""
    if content_key not in _CONTENT_KEYS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid content_key. Must be one of: {', '.join(_CONTENT_KEYS)}",
        )

    setting = db.query(ContentVisibility).filter(
        ContentVisibility.content_key == content_key,
        ContentVisibility.scope == "global",
    ).first()

    if setting:
        setting.is_visible = update.is_visible
    else:
        setting = ContentVisibility(
            content_key=content_key,
            is_visible=update.is_visible,
            scope="global",
        )
        db.add(setting)

    db.commit()
    db.refresh(setting)
    return setting


@router.patch("/content-visibility/users/{user_id}/{content_key}", response_model=ContentVisibilityRead)
def set_user_visibility(
    user_id: int,
    content_key: str,
    update: ContentVisibilityUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Set a per-user content visibility override."""
    if content_key not in _CONTENT_KEYS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid content_key. Must be one of: {', '.join(_CONTENT_KEYS)}",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    override = db.query(ContentVisibility).filter(
        ContentVisibility.content_key == content_key,
        ContentVisibility.scope == "user",
        ContentVisibility.user_id == user_id,
    ).first()

    if override:
        override.is_visible = update.is_visible
    else:
        override = ContentVisibility(
            content_key=content_key,
            is_visible=update.is_visible,
            scope="user",
            user_id=user_id,
        )
        db.add(override)

    db.commit()
    db.refresh(override)
    return override


@router.delete("/content-visibility/users/{user_id}/{content_key}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user_visibility(
    user_id: int,
    content_key: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Remove a per-user content visibility override (reverts to global)."""
    override = db.query(ContentVisibility).filter(
        ContentVisibility.content_key == content_key,
        ContentVisibility.scope == "user",
        ContentVisibility.user_id == user_id,
    ).first()

    if override:
        db.delete(override)
        db.commit()

    return None
