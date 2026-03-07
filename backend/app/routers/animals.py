from fastapi import APIRouter, Depends, HTTPException  # type: ignore
from sqlalchemy.orm import Session  # type: ignore
from typing import List
from ..db.session import get_db  # type: ignore
from ..models.all_models import Animal, VaccinationLog, TreatmentLog, User, UserRole  # type: ignore
from ..schemas.livestock import AnimalCreate, AnimalInDB, VaccinationLogCreate, VaccinationLogInDB  # type: ignore
from .deps import get_current_active_user  # type: ignore
from uuid import UUID

router = APIRouter()

@router.get("/", response_model=List[AnimalInDB])
def read_animals(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    query = db.query(Animal)
    if current_user.role == UserRole.FARMER:
        query = query.filter(Animal.farm_id == current_user.farm_id)
    return query.all()

@router.post("/", response_model=AnimalInDB)
def create_animal(animal_in: AnimalCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    if current_user.role == UserRole.FARMER and animal_in.farm_id != current_user.farm_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    db_animal = Animal(**animal_in.dict())
    db.add(db_animal)
    db.commit()
    db.refresh(db_animal)
    return db_animal
