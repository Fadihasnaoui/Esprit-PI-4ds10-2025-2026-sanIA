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
    birth_date: datetime

class AnimalCreate(AnimalBase):
    farm_id: UUID

class AnimalInDB(AnimalBase):
    id: UUID
    farm_id: UUID
    created_at: datetime
    class Config: from_attributes = True
