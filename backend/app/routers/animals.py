from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks  # type: ignore
from sqlalchemy.orm import Session  # type: ignore
from typing import List
from ..db.session import get_db  # type: ignore
from ..models.all_models import Animal, VaccinationLog, TreatmentLog, User, UserRole, AnimalTelemetry  # type: ignore
from ..schemas.livestock import (
    AnimalCreate, AnimalUpdate, AnimalSummary, AnimalInDB, 
    VaccinationLogCreate, VaccinationLogInDB, TreatmentLogCreate, 
    TreatmentLogInDB, AnimalTelemetryInDB, LivestockZoneCreate, LivestockZoneInDB
) # type: ignore
from .deps import get_current_active_user  # type: ignore
from uuid import UUID
from sqlalchemy import desc

import os, re, random, uuid
from datetime import datetime
from ..models.all_models import Farm, Cooperative, Animal, VaccinationLog, TreatmentLog, User, UserRole, AnimalTelemetry, LivestockZone  # type: ignore

def sync_to_sql_file():
    """Refreshes the livestock_seed.sql with current DB state for persistence."""
    from ..db.session import SessionLocal
    db = SessionLocal()
    try:
        animals = db.query(Animal).all()
        sql_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "Data", "Livestock", "livestock_seed.sql"))
        
        with open(sql_path, "w", encoding="utf-8") as f:
            f.write("-- Smart Farm Livestock Management - Sync v3.3 (Secure Async)\n")
            f.write(f"-- Auto-generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            f.write("BEGIN;\n\n")
            f.write("INSERT INTO livestock (id, tag_number, species, breed, gender, birth_date, entry_date, status, weight_kg, latitude, longitude) VALUES\n")
            
            lines = []
            for a in animals:
                b_date = a.birth_date.strftime("%Y-%m-%d") if a.birth_date else ""
                e_date = a.entry_date.strftime("%Y-%m-%d") if a.entry_date else ""
                w = a.weight_kg if a.weight_kg is not None else "NULL"
                lat = a.latitude if a.latitude is not None else "NULL"
                lng = a.longitude if a.longitude is not None else "NULL"
                line = f"  ('{a.id}', '{a.tag_id}', '{a.species}', '{a.breed}', '{a.gender}', '{b_date}', '{e_date}', '{a.status}', {w}, {lat}, {lng})"
                lines.append(line)
            
            if lines:
                f.write(",\n".join(lines))
                f.write(";\n")
            else:
                f.write("SELECT 1; -- Empty set\n")
            
            f.write("\nCOMMIT;")
        print(f"Background Sync Success: {len(animals)} animals saved.")
    except Exception as e:
        print(f"Sync to SQL background task failed: {e}")
    finally:
        db.close()

router = APIRouter()

@router.get("/", response_model=List[AnimalSummary])
def read_animals(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    # Simple check for farms (to ensure at least a farm exists)
    if db.query(Farm).count() == 0:
        try:
            coop = Cooperative(name="Coopérative Centrale")
            db.add(coop)
            db.flush()
            farm = Farm(name="Ferme Expérimentale", cooperative_id=coop.id)
            db.add(farm)
            db.commit()
        except:
            db.rollback()
            
    query = db.query(Animal)
    if current_user.role == UserRole.FARMER:
        query = query.filter(Animal.farm_id == current_user.farm_id)
    return query.all()

@router.post("/", response_model=AnimalSummary)
def create_animal(animal_in: AnimalCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    if current_user.role == UserRole.FARMER and str(animal_in.farm_id) != str(current_user.farm_id):
        raise HTTPException(status_code=403, detail="Forbidden")
    data = animal_in.dict()
    data["farm_id"] = str(data["farm_id"])
    db_animal = Animal(**data)
    db.add(db_animal)
    db.commit()
    db.refresh(db_animal)
    background_tasks.add_task(sync_to_sql_file) # Re-enabled: Persist changes to SQL
    return db_animal

@router.get("/zones", response_model=List[LivestockZoneInDB])
def get_zones(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    query = db.query(LivestockZone)
    if current_user.role == UserRole.FARMER:
        query = query.filter(LivestockZone.farm_id == str(current_user.farm_id))
    return query.all()

@router.post("/zones", response_model=LivestockZoneInDB)
def create_zone(zone_in: LivestockZoneCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    if current_user.role == UserRole.FARMER and str(zone_in.farm_id) != str(current_user.farm_id):
        raise HTTPException(status_code=403, detail="Forbidden")
    data = zone_in.dict()
    data["farm_id"] = str(data["farm_id"])
    db_zone = LivestockZone(**data)
    db.add(db_zone)
    db.commit()
    db.refresh(db_zone)
    return db_zone

@router.delete("/zones/{zone_id}")
def delete_zone(zone_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    db_zone = db.query(LivestockZone).filter(LivestockZone.id == str(zone_id)).first()
    if not db_zone:
        raise HTTPException(status_code=404, detail="Zone not found")
    if current_user.role == UserRole.FARMER and db_zone.farm_id != current_user.farm_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    
    db.delete(db_zone)
    db.commit()
    return {"status": "success"}

@router.get("/{animal_id}", response_model=AnimalInDB)
def get_animal(animal_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    animal = db.query(Animal).filter(Animal.id == str(animal_id)).first()
    if not animal:
        raise HTTPException(status_code=404, detail="Animal not found")
    if current_user.role == UserRole.FARMER and animal.farm_id != current_user.farm_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    return animal

@router.put("/{animal_id}", response_model=AnimalSummary)
def update_animal(animal_id: UUID, animal_in: AnimalUpdate, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    db_animal = db.query(Animal).filter(Animal.id == str(animal_id)).first()
    if not db_animal:
        raise HTTPException(status_code=404, detail="Animal not found")
    if current_user.role == UserRole.FARMER and db_animal.farm_id != current_user.farm_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    
    update_data = animal_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_animal, field, value)
    
    db.add(db_animal)
    db.commit()
    db.refresh(db_animal)
    background_tasks.add_task(sync_to_sql_file) # Re-enabled: Persist changes to SQL
    return db_animal

@router.delete("/{animal_id}")
def delete_animal(animal_id: UUID, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    db_animal = db.query(Animal).filter(Animal.id == str(animal_id)).first()
    if not db_animal:
        raise HTTPException(status_code=404, detail="Animal not found")
    if current_user.role == UserRole.FARMER and db_animal.farm_id != current_user.farm_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    
    db.delete(db_animal)
    db.commit()
    background_tasks.add_task(sync_to_sql_file) # Re-enabled: Persist changes to SQL
    return {"status": "success"}

@router.get("/{animal_id}/telemetry", response_model=List[AnimalTelemetryInDB])
def get_animal_telemetry(animal_id: UUID, limit: int = 100, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    # Check access
    animal = db.query(Animal).filter(Animal.id == str(animal_id)).first()
    if not animal:
        raise HTTPException(status_code=404, detail="Animal not found")
    if current_user.role == UserRole.FARMER and animal.farm_id != current_user.farm_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    
    readings = db.query(AnimalTelemetry).filter(AnimalTelemetry.animal_id == str(animal_id))\
                 .order_by(desc(AnimalTelemetry.time)).limit(limit).all()
    return readings

# --- Vaccination Logs ---
@router.post("/{animal_id}/vaccinations", response_model=VaccinationLogInDB)
def add_vaccination(animal_id: UUID, log_in: VaccinationLogCreate, db: Session = Depends(get_db)):
    db_log = VaccinationLog(**log_in.dict(), animal_id=str(animal_id))
    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    return db_log

@router.delete("/vaccinations/{log_id}")
def delete_vaccination(log_id: UUID, db: Session = Depends(get_db)):
    db_log = db.query(VaccinationLog).filter(VaccinationLog.id == str(log_id)).first()
    if not db_log:
        raise HTTPException(status_code=404, detail="Log not found")
    db.delete(db_log)
    db.commit()
    return {"status": "success"}

# --- Treatment Logs ---
@router.post("/{animal_id}/treatments", response_model=TreatmentLogInDB)
def add_treatment(animal_id: UUID, log_in: TreatmentLogCreate, db: Session = Depends(get_db)):
    db_log = TreatmentLog(**log_in.dict(), animal_id=str(animal_id))
    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    return db_log

@router.delete("/treatments/{log_id}")
def delete_treatment(log_id: UUID, db: Session = Depends(get_db)):
    db_log = db.query(TreatmentLog).filter(TreatmentLog.id == str(log_id)).first()
    if not db_log:
        raise HTTPException(status_code=404, detail="Log not found")
    db.delete(db_log)
    db.commit()
    return {"status": "success"}

