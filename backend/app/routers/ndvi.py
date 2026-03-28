from fastapi import APIRouter, Depends, HTTPException, Query  # type: ignore
from sqlalchemy.orm import Session  # type: ignore
from typing import List
from ..db.session import get_db  # type: ignore
from ..models.all_models import NDVIRecord, Field, User, UserRole  # type: ignore
from .deps import get_current_active_user  # type: ignore
from ..services.ndvi_diagnostic import ndvi_diagnostic_service
from pydantic import BaseModel
from uuid import UUID
from datetime import datetime, timedelta

router = APIRouter()

class NDVIRecordSchema(BaseModel):
    id: UUID
    field_id: UUID
    ndvi_value: float
    status: str
    captured_at: datetime
    class Config:
        from_attributes = True

@router.get("/{field_id}", response_model=List[NDVIRecordSchema])
def get_fiPeld_ndvi_history(field_id: UUID, weeks: int = Query(8, ge=1), db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    field = db.query(Field).filter(Field.id == field_id).first()
    if not field: raise HTTPException(status_code=404, detail="Field not found")
    if current_user.role == UserRole.FARMER and field.farm_id != current_user.farm_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    since = datetime.now() - timedelta(weeks=weeks)
    return db.query(NDVIRecord).filter(NDVIRecord.field_id == field_id, NDVIRecord.captured_at >= since).all()

@router.get("/{field_id}/spatial-diagnostic")
def get_field_spatial_diagnostic(field_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    field = db.query(Field).filter(Field.id == field_id).first()
    if not field: raise HTTPException(status_code=404, detail="Field not found")
    
    # Check permissions
    if current_user.role == UserRole.FARMER and field.farm_id != current_user.farm_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    
    if not field.polygon_geojson or field.polygon_geojson == "[]":
        return {"error": "No polygon defined for this field"}
        
    diagnostic = ndvi_diagnostic_service.get_real_diagnostic(db, field_id, field.polygon_geojson)
    return diagnostic

