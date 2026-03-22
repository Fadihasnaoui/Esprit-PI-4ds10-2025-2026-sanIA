from fastapi import APIRouter, Depends, HTTPException  # type: ignore
from sqlalchemy.orm import Session  # type: ignore
from typing import List
from ..db.session import get_db  # type: ignore
from ..models.all_models import Alert, User, UserRole  # type: ignore
from ..schemas.alerts import AlertInDB, AlertUpdate  # type: ignore
from .deps import get_current_active_user  # type: ignore
from uuid import UUID

router = APIRouter()

@router.get("/", response_model=List[AlertInDB])
def read_alerts(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    query = db.query(Alert)
    if current_user.role == UserRole.FARMER:
        query = query.filter(Alert.farm_id == current_user.farm_id)
    return query.order_by(Alert.created_at.desc()).all()

@router.patch("/{id}", response_model=AlertInDB)
def update_alert(id: UUID, alert_in: AlertUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    alert = db.query(Alert).filter(Alert.id == id).first()
    if not alert: raise HTTPException(status_code=404, detail="Alert not found")
    if current_user.role == UserRole.FARMER and alert.farm_id != current_user.farm_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    alert.status = alert_in.status
    if alert_in.note: alert.note = alert_in.note
    db.commit()
    db.refresh(alert)
    return alert
