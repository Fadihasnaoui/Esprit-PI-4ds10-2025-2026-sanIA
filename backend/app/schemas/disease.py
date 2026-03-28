from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime

class DiseaseScanBase(BaseModel):
    field_id: UUID
    crop_type: str
    image_url: str

class DiseaseScanCreate(DiseaseScanBase):
    predicted_disease: str
    confidence: float

class DiseaseScanInDB(DiseaseScanBase):
    id: UUID
    predicted_disease: str
    confidence: float
    created_at: datetime
    class Config: from_attributes = True
