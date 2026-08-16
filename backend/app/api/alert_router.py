# File: app/api/alert_router.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.db.session import get_db
from app.schemas.alert_schema import AlertOut
from app.crud import alert_crud
from app.core import deps
from app.models.user import User

router = APIRouter()

# ✅ --- NEW ENDPOINT ---
@router.get("/unread", response_model=List[AlertOut])
def list_unread_user_alerts(
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Get all unread notifications for the current user."""
    return alert_crud.get_unread_alerts(db, user_id=current_user.id)

@router.put("/read-all")
def acknowledge_all_user_alerts(
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Marks every unread notification as read -- "Mark all as read"."""
    count = alert_crud.acknowledge_all_alerts(db, user_id=current_user.id)
    return {"acknowledged": count}

# ✅ --- MODIFIED ENDPOINT ---
# Changed path to make it more RESTful
@router.put("/{alert_id}/acknowledge", response_model=AlertOut)
def acknowledge_user_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Mark a notification as read."""
    alert = alert_crud.acknowledge_alert(db, alert_id=alert_id, user_id=current_user.id)
    if not alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
    return alert


# --- Existing endpoints (for completeness, no changes needed) ---
@router.get("/", response_model=List[AlertOut])
def list_all_user_alerts(
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    return alert_crud.get_all_alerts(db, user_id=current_user.id)