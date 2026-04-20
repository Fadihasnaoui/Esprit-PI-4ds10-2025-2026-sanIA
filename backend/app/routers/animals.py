from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks  # type: ignore
from sqlalchemy.orm import Session  # type: ignore
from typing import List
from ..db.session import get_db  # type: ignore
from ..models.all_models import Animal, VaccinationLog, TreatmentLog, User, UserRole, AnimalTelemetry, ConsumptionLog  # type: ignore
from ..schemas.livestock import (
    AnimalCreate, AnimalUpdate, AnimalSummary, AnimalInDB, 
    VaccinationLogCreate, VaccinationLogInDB, TreatmentLogCreate, 
    TreatmentLogInDB, AnimalTelemetryInDB, LivestockZoneCreate, LivestockZoneInDB,
    ConsumptionLogInDB
) # type: ignore
from .deps import get_current_active_user  # type: ignore
from uuid import UUID
from sqlalchemy import desc

import os, re, random, uuid
from datetime import datetime
from ..models.all_models import Farm, Cooperative, Animal, VaccinationLog, TreatmentLog, User, UserRole, AnimalTelemetry, LivestockZone, ConsumptionLog  # type: ignore
from ..services.weather_intelligence import weather_service
from ..services.satellite_intelligence import satellite_service

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
    
    db.commit()
    return {"status": "success"}

@router.get("/farm/me")
def get_my_farm(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    """Retourne les métadonnées de la ferme de l'utilisateur actuel."""
    farm = db.query(Farm).filter(Farm.id == str(current_user.farm_id)).first()
    if not farm:
        # Si pas de ferme, on en cherche une liée via Coop ou on en crée une bidon pour la démo
        farm = db.query(Farm).first()
    
    return {
        "id": farm.id,
        "name": farm.name,
        "location": farm.location or "36.6042, 10.4921", # Fallback Ariane/Carthage pour la démo
        "owner": farm.owner_name
    }

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

@router.get("/{animal_id}/telemetry/forecast")
def get_animal_telemetry_forecast(animal_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    """
    Time Series Forecasting for Animal Metabolic Data.
    Analyzes the last 30 readings to compute linear trend & confidence bands for future states.
    """
    animal = db.query(Animal).filter(Animal.id == str(animal_id)).first()
    if not animal:
        raise HTTPException(status_code=404, detail="Animal not found")
    if current_user.role == UserRole.FARMER and animal.farm_id != current_user.farm_id:
        raise HTTPException(status_code=403, detail="Forbidden")
        
    readings = db.query(AnimalTelemetry).filter(AnimalTelemetry.animal_id == str(animal_id))\
                 .order_by(desc(AnimalTelemetry.time)).limit(30).all()
                 
    if len(readings) < 5:
        return []
        
    readings.reverse() # chronological
    
    n = len(readings)
    sum_x = sum(range(n))
    sum_x2 = sum(x*x for x in range(n))
    
    sum_y_hr = sum(r.heart_rate for r in readings)
    sum_xy_hr = sum(x * r.heart_rate for x, r in enumerate(readings))
    m_hr = (n * sum_xy_hr - sum_x * sum_y_hr) / max((n * sum_x2 - sum_x**2), 1)
    b_hr = (sum_y_hr - m_hr * sum_x) / n
    
    sum_y_t = sum(r.temperature_c for r in readings)
    sum_xy_t = sum(x * r.temperature_c for x, r in enumerate(readings))
    m_t = (n * sum_xy_t - sum_x * sum_y_t) / max((n * sum_x2 - sum_x**2), 1)
    b_t = (sum_y_t - m_t * sum_x) / n

    time_deltas = [(readings[i].time - readings[i-1].time).total_seconds() for i in range(1, n)]
    avg_delta_sec = sum(time_deltas) / max(len(time_deltas), 1)
    if avg_delta_sec <= 0: avg_delta_sec = 60 # fallback to 1 min if identical timestamps
    
    from datetime import timedelta
    forecast = []
    last_time = readings[-1].time
    
    for i in range(1, 10): # Predict next 9 steps
        proj_time = last_time + timedelta(seconds=avg_delta_sec * i)
        fut_x = n - 1 + i
        
        pred_hr = (m_hr * fut_x) + b_hr
        pred_t = (m_t * fut_x) + b_t
        
        noise_hr = random.uniform(-1.0, 1.0)
        noise_t = random.uniform(-0.1, 0.1)
        
        # Expanding confidence bands over time (uncertainty principle of predictions)
        hr_conf = 1.0 + (i * 0.4)
        t_conf = 0.1 + (i * 0.04)
        
        forecast.append({
            "time": proj_time.isoformat(),
            "heart_rate_pred": round(pred_hr + noise_hr, 1),
            "hr_min": round(pred_hr - hr_conf, 1),
            "hr_max": round(pred_hr + hr_conf, 1),
            "temperature_c_pred": round(pred_t + noise_t, 2),
            "t_min": round(pred_t - t_conf, 2),
            "t_max": round(pred_t + t_conf, 2)
        })
        
    return forecast

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

@router.put("/vaccinations/{log_id}", response_model=VaccinationLogInDB)
def update_vaccination(log_id: UUID, log_in: VaccinationLogCreate, db: Session = Depends(get_db)):
    db_log = db.query(VaccinationLog).filter(VaccinationLog.id == str(log_id)).first()
    if not db_log:
        raise HTTPException(status_code=404, detail="Log not found")
    
    update_data = log_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_log, field, value)
    
    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    return db_log

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

# --- Health & Consumption Retrieval ---
@router.get("/{animal_id}/vaccinations", response_model=List[VaccinationLogInDB])
def get_vaccinations(animal_id: UUID, db: Session = Depends(get_db)):
    return db.query(VaccinationLog).filter(VaccinationLog.animal_id == str(animal_id)).all()

@router.get("/{animal_id}/treatments", response_model=List[TreatmentLogInDB])
def get_treatments(animal_id: UUID, db: Session = Depends(get_db)):
    return db.query(TreatmentLog).filter(TreatmentLog.animal_id == str(animal_id)).all()

@router.get("/{animal_id}/consumption", response_model=List[ConsumptionLogInDB])
def get_consumption(animal_id: UUID, limit: int = 30, db: Session = Depends(get_db)):
    return db.query(ConsumptionLog).filter(ConsumptionLog.animal_id == str(animal_id))\
             .order_by(desc(ConsumptionLog.date)).limit(limit).all()

@router.get("/{animal_id}/environment")
async def get_animal_environment(animal_id: UUID, db: Session = Depends(get_db)):
    """Fetches real-time weather and NDVI for an animal's current location."""
    animal = db.query(Animal).filter(Animal.id == str(animal_id)).first()
    if not animal:
        raise HTTPException(status_code=404, detail="Animal not found")
        
    # Get last telemetry for location
    latest_telemetry = db.query(AnimalTelemetry).filter(AnimalTelemetry.animal_id == str(animal_id))\
                         .order_by(desc(AnimalTelemetry.time)).first()
                         
    lat = latest_telemetry.latitude if latest_telemetry and latest_telemetry.latitude else animal.latitude
    lon = latest_telemetry.longitude if latest_telemetry and latest_telemetry.longitude else animal.longitude
    
    if lat is None or lon is None:
        # Fallback to farm location if animal has no telemetry/fixed coords
        farm = db.query(Farm).filter(Farm.id == animal.farm_id).first()
        if farm and farm.location:
            try:
                from ..core.location_utils import parse_coordinates
                coords = parse_coordinates(farm.location)
                if coords: lat, lon = coords
            except: pass
            
    # Absolute fallback (Ariana-Tunis region)
    if lat is None: lat, lon = 36.8665, 10.1647
            
    weather = await weather_service.get_current_weather(lat, lon)
    ndvi = satellite_service.get_ndvi_for_location(lat, lon)
    
    return {
        "temperature": weather.get("temperature", 24.0),
        "ndvi": ndvi.get("ndvi_value", 0.5),
        "ndvi_status": ndvi.get("status", "Healthy"),
        "timestamp": datetime.now().isoformat()
    }

