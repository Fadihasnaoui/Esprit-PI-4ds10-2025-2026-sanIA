from fastapi import APIRouter, Depends, HTTPException  # type: ignore
from sqlalchemy.orm import Session  # type: ignore
from typing import List
from ..db.session import get_db  # type: ignore
from ..models.all_models import DiseaseScan, Field, User, UserRole  # type: ignore
from ..schemas.disease import DiseaseScanCreate, DiseaseScanInDB  # type: ignore
from .deps import get_current_active_user  # type: ignore
from uuid import UUID

router = APIRouter()

@router.get("/", response_model=List[DiseaseScanInDB])
def read_scans(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    query = db.query(DiseaseScan).join(Field)
    if current_user.role == UserRole.FARMER:
        query = query.filter(Field.farm_id == current_user.farm_id)
    return query.all()

@router.post("/", response_model=DiseaseScanInDB)
def create_scan(scan_in: DiseaseScanCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    field = db.query(Field).filter(Field.id == scan_in.field_id).first()
    if not field: raise HTTPException(status_code=404, detail="Field not found")
    if current_user.role == UserRole.FARMER and field.farm_id != current_user.farm_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    db_scan = DiseaseScan(**scan_in.dict())
    db.add(db_scan)
    db.commit()
    db.refresh(db_scan)

    # TODO: Trigger Asynchronous AI Analysis Task
    # 1. Upload image to MinIO if not already there
    # 2. Call Computer Vision Model for Disease Detection
    # 3. Use LLM (RAG) to generate recommendations based on findings
    # 4. Update scan status and results via callback/polling

    return db_scan
