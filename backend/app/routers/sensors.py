from fastapi import APIRouter, Depends, HTTPException, Query  # type: ignore
from sqlalchemy.orm import Session  # type: ignore
from typing import List
from ..db.session import get_db  # type: ignore
from ..models.all_models import SensorReading, Field, User, UserRole  # type: ignore
from ..schemas.sensors import SensorReadingCreate, SensorReadingInDB  # type: ignore
from .deps import get_current_active_user  # type: ignore
from ..services.weather_intelligence import weather_service
from ..core.location_utils import parse_coordinates
from ..models.all_models import Farm
from uuid import UUID
from datetime import datetime, timedelta

router = APIRouter()

@router.get("/{field_id}", response_model=List[SensorReadingInDB])
def read_sensor_history(
    field_id: UUID,
    days: int = Query(7, ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    field = db.query(Field).filter(Field.id == field_id).first()
    if not field: raise HTTPException(status_code=404, detail="Field not found")
    if current_user.role == UserRole.FARMER and field.farm_id != current_user.farm_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    since = datetime.now() - timedelta(days=days)
    return db.query(SensorReading).filter(SensorReading.field_id == field_id, SensorReading.created_at >= since).all()

@router.post("/", response_model=SensorReadingInDB)
def ingest_sensor_data(reading_in: SensorReadingCreate, db: Session = Depends(get_db)):
    db_reading = SensorReading(**reading_in.dict())
    db.add(db_reading)
    db.commit()
    db.refresh(db_reading)
    return db_reading

@router.get("/weather/{farm_id}")
async def get_real_time_weather(farm_id: UUID, db: Session = Depends(get_db)):
    """Fetches real-time weather from Open-Meteo for any farm location."""
    farm = db.query(Farm).filter(Farm.id == farm_id).first()
    if not farm: raise HTTPException(status_code=404, detail="Farm not found")
    
    coords = parse_coordinates(farm.location)
    if not coords:
        raise HTTPException(status_code=400, detail="Farm location coordinates not set (Format: 'lat, lon').")
        
    return await weather_service.get_current_weather(coords[0], coords[1])
