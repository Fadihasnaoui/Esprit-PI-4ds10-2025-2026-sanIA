from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime

class SensorReadingBase(BaseModel):
    field_id: UUID
    soil_moisture: float
    temperature_c: float
    humidity_pct: float

class SensorReadingCreate(SensorReadingBase):
    pass

class SensorReadingInDB(SensorReadingBase):
    id: UUID
    created_at: datetime
    class Config: from_attributes = True

class IrrigationLogBase(BaseModel):
    field_id: UUID
    recommended_minutes: int
    executed_minutes: Optional[int] = None
    water_estimate_m3: float
    status: str

class IrrigationLogCreate(IrrigationLogBase):
    pass

class IrrigationLogInDB(IrrigationLogBase):
    id: UUID
    created_at: datetime
    class Config: from_attributes = True
