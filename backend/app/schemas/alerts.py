from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime

class AlertBase(BaseModel):
    farm_id: UUID
    field_id: Optional[UUID] = None
    type: str
    severity: str
    status: str = "open"
    note: Optional[str] = None

class AlertCreate(AlertBase):
    pass

class AlertUpdate(BaseModel):
    status: str
    note: Optional[str] = None

class AlertInDB(AlertBase):
    id: UUID
    created_at: datetime
    class Config: from_attributes = True
