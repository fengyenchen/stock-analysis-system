from typing import List, Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_active_user
from app.models import ContentVisibility, User
from app.schemas import ContentVisibilityEffectiveRead

router = APIRouter(prefix="/content-visibility", tags=["Content Visibility"])

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


def _get_effective_visibility(db: Session, user_id: Optional[int] = None) -> dict:
    global_settings = {
        s.content_key: s.is_visible
        for s in db.query(ContentVisibility).filter(ContentVisibility.scope == "global").all()
    }
    result = {key: global_settings.get(key, True) for key in _CONTENT_KEYS}

    if user_id:
        overrides = db.query(ContentVisibility).filter(
            ContentVisibility.scope == "user",
            ContentVisibility.user_id == user_id,
        ).all()
        for override in overrides:
            result[override.content_key] = override.is_visible

    return result


@router.get("", response_model=List[ContentVisibilityEffectiveRead])
def get_my_visibility(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Get effective content visibility for the current user."""
    effective = _get_effective_visibility(db, current_user.id)
    return [ContentVisibilityEffectiveRead(content_key=k, is_visible=v) for k, v in effective.items()]


@router.get("/public", response_model=List[ContentVisibilityEffectiveRead])
def get_public_visibility(db: Session = Depends(get_db)):
    """Get global content visibility (for unauthenticated users)."""
    effective = _get_effective_visibility(db, None)
    return [ContentVisibilityEffectiveRead(content_key=k, is_visible=v) for k, v in effective.items()]
