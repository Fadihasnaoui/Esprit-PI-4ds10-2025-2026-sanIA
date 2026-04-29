from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime


class DiseaseScanBase(BaseModel):
    field_id: Optional[UUID] = None
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

    class Config:
        from_attributes = True


class DiseaseTopPrediction(BaseModel):
    disease: str
    confidence: float


class DetectionResult(BaseModel):
    predicted_disease: str
    confidence: float
    top5: List[DiseaseTopPrediction]
    saved_scan_id: Optional[str] = None
    severity_pct: Optional[float] = None
    severity_label: Optional[str] = None
    severity_color: Optional[str] = None
