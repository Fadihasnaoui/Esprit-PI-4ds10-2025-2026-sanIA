from pydantic import BaseModel
from uuid import UUID
from datetime import datetime

class NDVIRecordBase(BaseModel):
    field_id: UUID
    ndvi_value: float
    status: str
    captured_at: datetime

class NDVIRecordCreate(NDVIRecordBase):
    pass

class NDVIRecordInDB(NDVIRecordBase):
    id: UUID
    class Config: from_attributes = True
