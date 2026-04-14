from fastapi import APIRouter, Depends, HTTPException  # type: ignore
from sqlalchemy.orm import Session  # type: ignore
from typing import List
from ..db.session import get_db  # type: ignore
from ..models.all_models import Field, User, UserRole, IrrigationLog  # type: ignore
from ..schemas.field import FieldCreate, FieldInDB, FieldUpdate  # type: ignore
from ..schemas.sensors import IrrigationLogCreate, IrrigationLogInDB  # type: ignore
from .deps import get_current_active_user  # type: ignore
from uuid import UUID

router = APIRouter()

@router.get("/", response_model=List[FieldInDB])
def read_fields(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = db.query(Field)
    if current_user.role == UserRole.FARMER:
        query = query.filter(Field.farm_id == current_user.farm_id)
    return query.all()

@router.post("/", response_model=FieldInDB)
def create_field(
    field_in: FieldCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    if current_user.role == UserRole.FARMER and field_in.farm_id != current_user.farm_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    db_field = Field(**field_in.dict())
    db.add(db_field)
    db.commit()
    db.refresh(db_field)
    return db_field

@router.put("/{field_id}", response_model=FieldInDB)
def update_field(
    field_id: UUID,
    field_in: FieldUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    db_field = db.query(Field).filter(Field.id == field_id).first()
    if not db_field:
        raise HTTPException(status_code=404, detail="Field not found")
    if current_user.role == UserRole.FARMER and db_field.farm_id != current_user.farm_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = field_in.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_field, key, value)
        
    db.commit()
    db.refresh(db_field)
    return db_field

@router.delete("/{field_id}", response_model=dict)
def delete_field(
    field_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    db_field = db.query(Field).filter(Field.id == field_id).first()
    if not db_field:
        raise HTTPException(status_code=404, detail="Field not found")
    if current_user.role == UserRole.FARMER and db_field.farm_id != current_user.farm_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    db.delete(db_field)
    db.commit()
    return {"message": "Field deleted successfully"}

@router.get("/{id}/irrigation-logs", response_model=List[IrrigationLogInDB])
def read_irrigation_logs(id: UUID, db: Session = Depends(get_db)):
    return db.query(IrrigationLog).filter(IrrigationLog.field_id == id).all()
