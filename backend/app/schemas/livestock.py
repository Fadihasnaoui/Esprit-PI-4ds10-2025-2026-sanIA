from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime

class VaccinationLogBase(BaseModel):
    vaccine_name: str
    dose: str
    vet_name: str
    date: datetime
    next_due_date: datetime

class VaccinationLogCreate(VaccinationLogBase):
    pass

class VaccinationLogInDB(VaccinationLogBase):
    id: UUID
    animal_id: UUID
    class Config: from_attributes = True

class TreatmentLogBase(BaseModel):
    diagnosis: str
    medicine: str
    dosage: str
    vet_note: Optional[str] = None
    date: datetime

class TreatmentLogCreate(TreatmentLogBase):
    pass

class TreatmentLogInDB(TreatmentLogBase):
    id: UUID
    animal_id: UUID
    class Config: from_attributes = True

class AnimalBase(BaseModel):
    tag_id: str
    species: str
    breed: str
    gender: Optional[str] = "Female"
    birth_date: datetime
    entry_date: Optional[datetime] = None
    status: str = "Active"
    weight_kg: Optional[float] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class AnimalCreate(AnimalBase):
    farm_id: UUID

class AnimalUpdate(BaseModel):
    tag_id: Optional[str] = None
    species: Optional[str] = None
    breed: Optional[str] = None
    gender: Optional[str] = None
    birth_date: Optional[datetime] = None
    entry_date: Optional[datetime] = None
    status: Optional[str] = None
    weight_kg: Optional[float] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class AnimalTelemetryInDB(BaseModel):
    time: datetime
    heart_rate: float
    temperature_c: float
    activity_level: str
    latitude: float
    longitude: float
    weight_kg: Optional[float] = None
    class Config: from_attributes = True

class AnimalSummary(AnimalBase):
    id: UUID
    farm_id: UUID
    created_at: datetime
    vaccinations: List[VaccinationLogInDB] = []
    treatments: List[TreatmentLogInDB] = []
    class Config: from_attributes = True

class AnimalInDB(AnimalBase):
    id: UUID
    farm_id: UUID
    created_at: datetime
    vaccinations: List[VaccinationLogInDB] = []
    treatments: List[TreatmentLogInDB] = []
    telemetry: List[AnimalTelemetryInDB] = []
    class Config: from_attributes = True
