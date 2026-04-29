from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime

class FieldBase(BaseModel):
    name: str
    crop_type: str
    area_ha: float
    polygon_geojson: Optional[str] = None

class FieldUpdate(BaseModel):
    name: Optional[str] = None
    crop_type: Optional[str] = None
    area_ha: Optional[float] = None
    polygon_geojson: Optional[str] = None

class FieldCreate(FieldBase):
    farm_id: UUID

class FieldInDB(FieldBase):
    id: UUID
    farm_id: UUID
    eosda_field_id: Optional[int] = None
    created_at: datetime
    class Config: from_attributes = True

class FarmBase(BaseModel):
    name: str
    location: str
    owner_name: str

class FarmCreate(FarmBase):
    cooperative_id: UUID

class FarmInDB(FarmBase):
    id: UUID
    cooperative_id: UUID
    created_at: datetime
    class Config: from_attributes = True
