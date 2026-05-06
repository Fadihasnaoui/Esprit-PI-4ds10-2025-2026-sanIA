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

import os
from datetime import datetime, timezone
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
    data["status"] = "Sain"
    db_animal = Animal(**data)
    db.add(db_animal)
    db.commit()
    db.refresh(db_animal)
    background_tasks.add_task(sync_to_sql_file)
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

_THI_THRESHOLDS = {
    "Bovin":  [
        {"max": 68,  "level": "Normal",  "color": "#4ade80", "reco": None},
        {"max": 72,  "level": "Légère",  "color": "#facc15", "reco": "Fournir de l'eau fraîche en continu. Éviter la surcharge des espaces."},
        {"max": 80,  "level": "Modérée", "color": "#fb923c", "reco": "Ventilation forcée. Limiter les déplacements à 6h–9h. Augmenter la ration en eau de 20%."},
        {"max": 90,  "level": "Sévère",  "color": "#ef4444", "reco": "Aspersion d'eau sur le corps. Rapprocher le bétail des zones ombragées. Contacter le vétérinaire."},
        {"max": 999, "level": "Urgence", "color": "#dc2626", "reco": "Intervention vétérinaire immédiate. Mise à l'abri obligatoire. Risque de mortalité élevé."},
    ],
    "Ovin": [
        {"max": 70,  "level": "Normal",  "color": "#4ade80", "reco": None},
        {"max": 78,  "level": "Légère",  "color": "#facc15", "reco": "Tonte si pelage épais. Accès permanent à l'eau."},
        {"max": 85,  "level": "Modérée", "color": "#fb923c", "reco": "Ombrage obligatoire. Déplacements uniquement en matinée."},
        {"max": 999, "level": "Sévère",  "color": "#ef4444", "reco": "Pâturage interdit après 10h. Ventilation et aspersion."},
    ],
    "Caprin": [
        {"max": 73,  "level": "Normal",  "color": "#4ade80", "reco": None},
        {"max": 80,  "level": "Légère",  "color": "#facc15", "reco": "Renforcer l'apport en eau. Sel minéral en libre accès."},
        {"max": 87,  "level": "Modérée", "color": "#fb923c", "reco": "Réduire les sorties aux heures chaudes. Augmenter la ration d'eau de 15%."},
        {"max": 999, "level": "Sévère",  "color": "#ef4444", "reco": "Confinement à l'abri. Aspersion. Contrôle vétérinaire si halètement persistant."},
    ],
    "Cheval": [
        {"max": 72,  "level": "Normal",  "color": "#4ade80", "reco": None},
        {"max": 80,  "level": "Légère",  "color": "#facc15", "reco": "Réduire l'intensité d'entraînement. Augmenter l'abreuvement."},
        {"max": 90,  "level": "Modérée", "color": "#fb923c", "reco": "Pas d'effort physique intense. Douche froide post-exercice. Électrolytes dans l'eau."},
        {"max": 999, "level": "Sévère",  "color": "#ef4444", "reco": "Arrêt total de tout effort. Soins vétérinaires. Risque de coup de chaleur."},
    ],
}

def _classify_thi(species: str, thi: float) -> dict:
    thresholds = _THI_THRESHOLDS.get(species, _THI_THRESHOLDS["Bovin"])
    for t in thresholds:
        if thi < t["max"]:
            return {"level": t["level"], "color": t["color"], "reco": t["reco"]}
    return {"level": "Urgence", "color": "#7f1d1d", "reco": "Consultation vétérinaire immédiate."}

@router.get("/thi")
async def get_thi_panel(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    from ..services.weather_intelligence import weather_service
    from ..core.location_utils import parse_coordinates

    farm = db.query(Farm).filter(Farm.id == str(current_user.farm_id)).first()
    if not farm:
        farm = db.query(Farm).first()

    lat = lon = None
    if farm and farm.location:
        coords = parse_coordinates(farm.location)
        if coords:
            lat, lon = coords

    # Last resort: derive coordinates from any animal that has a known location
    if lat is None or lon is None:
        any_animal = (db.query(Animal)
                        .filter(Animal.latitude.isnot(None), Animal.longitude.isnot(None))
                        .first())
        if any_animal:
            lat, lon = any_animal.latitude, any_animal.longitude

    if lat is None or lon is None:
        raise HTTPException(
            status_code=422,
            detail="Aucune position connue (ferme + animaux). Renseignez farm.location."
        )

    thi_data = await weather_service.get_thi_forecast(lat, lon)
    if thi_data.get("thi_now") is None:
        return {"temp_now": None, "rh_now": None, "thi_now": None,
                "per_species": {}, "forecast": [], "stale": True,
                "coordinates": {"lat": round(lat,6), "lon": round(lon,6)}}
    species_list = ["Bovin", "Ovin", "Caprin", "Cheval"]
    per_species = {}
    for sp in species_list:
        status = _classify_thi(sp, thi_data["thi_now"])
        per_species[sp] = {"thi": thi_data["thi_now"], "level": status["level"],
                           "color": status["color"], "reco": status["reco"]}
    forecast = []
    for h in thi_data["forecast"]:
        row = {"time": h["time"], "temp": h["temp"], "rh": h["rh"], "thi": h["thi"]}
        for sp in species_list:
            st = _classify_thi(sp, h["thi"])
            row[f"level_{sp}"] = st["level"]
            row[f"color_{sp}"] = st["color"]
        forecast.append(row)
    return {"temp_now": thi_data["temp_now"], "rh_now": thi_data["rh_now"],
            "thi_now": thi_data["thi_now"], "per_species": per_species,
            "forecast": forecast, "coords": {"lat": round(lat,4), "lon": round(lon,4)}}

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
    Time-series forecast of vital signs using ARIMA(1,1,1) with empirical
    95% confidence intervals. Falls back to Holt-Winters then naive trend if
    ARIMA fails to converge. Output values are clamped to physiological bounds.
    """
    animal = db.query(Animal).filter(Animal.id == str(animal_id)).first()
    if not animal:
        raise HTTPException(status_code=404, detail="Animal not found")
    if current_user.role == UserRole.FARMER and animal.farm_id != current_user.farm_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    readings = db.query(AnimalTelemetry).filter(AnimalTelemetry.animal_id == str(animal_id))\
                 .order_by(desc(AnimalTelemetry.time)).limit(60).all()

    if len(readings) < 5:
        return []

    readings.reverse()

    from ..services.forecast_service import forecast_vitals
    return forecast_vitals(readings, species=animal.species or "Bovin", steps=9)


# ── Manual vital readings (farmer-entered, no IoT required) ─────────────
from pydantic import BaseModel as _PdBase, Field as _PdField
from typing import Optional

class ManualVitalReading(_PdBase):
    """Farmer-entered measurement from a real instrument:
       - heart_rate from stethoscope (BPM)
       - temperature_c from rectal thermometer (°C)
       - weight_kg from livestock scale
       - activity_level: observed behaviour (RESTING/EATING/WALKING/RUMINATING/RUNNING)
    """
    heart_rate:     Optional[float] = _PdField(default=None, ge=10, le=400)
    temperature_c:  Optional[float] = _PdField(default=None, ge=30, le=45)
    weight_kg:      Optional[float] = _PdField(default=None, ge=0.5, le=2000)
    activity_level: Optional[str]   = _PdField(default=None, max_length=32)
    note:           Optional[str]   = _PdField(default=None, max_length=500)


@router.post("/{animal_id}/telemetry/manual", response_model=AnimalTelemetryInDB)
def submit_manual_vital_reading(
    animal_id: UUID,
    reading: ManualVitalReading,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Persist a real, farmer-measured vital reading. At least one of
    heart_rate / temperature_c / weight_kg must be supplied. The reading
    is timestamped server-side and used by the forecast model and the
    intelligence daemon's anomaly checks.
    """
    if reading.heart_rate is None and reading.temperature_c is None and reading.weight_kg is None:
        raise HTTPException(
            status_code=400,
            detail="Au moins une mesure (FC, température, poids) doit être renseignée."
        )

    animal = db.query(Animal).filter(Animal.id == str(animal_id)).first()
    if not animal:
        raise HTTPException(status_code=404, detail="Animal not found")
    if current_user.role == UserRole.FARMER and animal.farm_id != current_user.farm_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    _VALID_ACTIVITIES = {"RESTING", "EATING", "WALKING", "RUMINATING", "RUNNING"}
    activity = (reading.activity_level or "RESTING").upper()
    if activity not in _VALID_ACTIVITIES:
        raise HTTPException(
            status_code=400,
            detail=f"Valeur activity_level invalide : '{activity}'. Valeurs acceptées : {sorted(_VALID_ACTIVITIES)}."
        )

    row = AnimalTelemetry(
        animal_id      = str(animal_id),
        time           = datetime.now(timezone.utc),
        heart_rate     = float(reading.heart_rate    or 0),
        temperature_c  = float(reading.temperature_c or 0),
        weight_kg      = float(reading.weight_kg     or animal.weight_kg or 0),
        activity_level = activity,
        latitude       = animal.latitude  or 0.0,
        longitude      = animal.longitude or 0.0,
    )
    db.add(row)

    # If a weight is supplied, also update the animal's reference weight so
    # the price calculator sees the latest measurement.
    if reading.weight_kg:
        animal.weight_kg = float(reading.weight_kg)

    db.commit()
    db.refresh(row)
    return row


def _get_animal_owned(animal_id: UUID, db: Session, current_user: User) -> Animal:
    """Fetch animal and verify ownership for FARMER role."""
    animal = db.query(Animal).filter(Animal.id == str(animal_id)).first()
    if not animal:
        raise HTTPException(status_code=404, detail="Animal not found")
    if current_user.role == UserRole.FARMER and animal.farm_id != current_user.farm_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    return animal


# --- Vaccination Logs ---
@router.post("/{animal_id}/vaccinations", response_model=VaccinationLogInDB)
def add_vaccination(animal_id: UUID, log_in: VaccinationLogCreate,
                    db: Session = Depends(get_db),
                    current_user: User = Depends(get_current_active_user)):
    _get_animal_owned(animal_id, db, current_user)
    db_log = VaccinationLog(**log_in.dict(), animal_id=str(animal_id))
    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    return db_log

@router.delete("/vaccinations/{log_id}")
def delete_vaccination(log_id: UUID, db: Session = Depends(get_db),
                       current_user: User = Depends(get_current_active_user)):
    db_log = db.query(VaccinationLog).filter(VaccinationLog.id == str(log_id)).first()
    if not db_log:
        raise HTTPException(status_code=404, detail="Log not found")
    _get_animal_owned(UUID(db_log.animal_id), db, current_user)
    db.delete(db_log)
    db.commit()
    return {"status": "success"}

@router.put("/vaccinations/{log_id}", response_model=VaccinationLogInDB)
def update_vaccination(log_id: UUID, log_in: VaccinationLogCreate,
                       db: Session = Depends(get_db),
                       current_user: User = Depends(get_current_active_user)):
    db_log = db.query(VaccinationLog).filter(VaccinationLog.id == str(log_id)).first()
    if not db_log:
        raise HTTPException(status_code=404, detail="Log not found")
    _get_animal_owned(UUID(db_log.animal_id), db, current_user)

    update_data = log_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_log, field, value)

    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    return db_log

# --- Treatment Logs ---
@router.post("/{animal_id}/treatments", response_model=TreatmentLogInDB)
def add_treatment(animal_id: UUID, log_in: TreatmentLogCreate,
                  db: Session = Depends(get_db),
                  current_user: User = Depends(get_current_active_user)):
    _get_animal_owned(animal_id, db, current_user)
    db_log = TreatmentLog(**log_in.dict(), animal_id=str(animal_id))
    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    return db_log

@router.delete("/treatments/{log_id}")
def delete_treatment(log_id: UUID, db: Session = Depends(get_db),
                     current_user: User = Depends(get_current_active_user)):
    db_log = db.query(TreatmentLog).filter(TreatmentLog.id == str(log_id)).first()
    if not db_log:
        raise HTTPException(status_code=404, detail="Log not found")
    _get_animal_owned(UUID(db_log.animal_id), db, current_user)
    db.delete(db_log)
    db.commit()
    return {"status": "success"}

# --- Health & Consumption Retrieval ---
@router.get("/{animal_id}/vaccinations", response_model=List[VaccinationLogInDB])
def get_vaccinations(animal_id: UUID, db: Session = Depends(get_db),
                     current_user: User = Depends(get_current_active_user)):
    _get_animal_owned(animal_id, db, current_user)
    return db.query(VaccinationLog).filter(VaccinationLog.animal_id == str(animal_id)).all()

@router.get("/{animal_id}/treatments", response_model=List[TreatmentLogInDB])
def get_treatments(animal_id: UUID, db: Session = Depends(get_db),
                   current_user: User = Depends(get_current_active_user)):
    _get_animal_owned(animal_id, db, current_user)
    return db.query(TreatmentLog).filter(TreatmentLog.animal_id == str(animal_id)).all()

@router.get("/{animal_id}/consumption", response_model=List[ConsumptionLogInDB])
def get_consumption(animal_id: UUID, limit: int = 30, db: Session = Depends(get_db),
                    current_user: User = Depends(get_current_active_user)):
    _get_animal_owned(animal_id, db, current_user)
    return db.query(ConsumptionLog).filter(ConsumptionLog.animal_id == str(animal_id))\
             .order_by(desc(ConsumptionLog.date)).limit(limit).all()


class ConsumptionEntry(_PdBase):
    """Daily consumption record entered by the farmer (real measurements)."""
    water_liters: float = _PdField(ge=0, le=500)
    food_kg:      float = _PdField(ge=0, le=200)
    date:         Optional[datetime] = None
    note:         Optional[str] = _PdField(default=None, max_length=500)


@router.post("/{animal_id}/consumption", response_model=ConsumptionLogInDB)
def add_consumption(
    animal_id: UUID,
    entry: ConsumptionEntry,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Log a real, farmer-measured daily consumption (water + feed).
    No automatic fake-data generation; one log per real observation."""
    animal = db.query(Animal).filter(Animal.id == str(animal_id)).first()
    if not animal:
        raise HTTPException(status_code=404, detail="Animal not found")
    if current_user.role == UserRole.FARMER and animal.farm_id != current_user.farm_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    log = ConsumptionLog(
        animal_id    = str(animal_id),
        water_liters = round(float(entry.water_liters), 2),
        food_kg      = round(float(entry.food_kg), 2),
        date         = entry.date or datetime.utcnow(),
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


@router.delete("/{animal_id}/consumption/{log_id}")
def delete_consumption(
    animal_id: UUID, log_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    animal = db.query(Animal).filter(Animal.id == str(animal_id)).first()
    if not animal:
        raise HTTPException(status_code=404, detail="Animal not found")
    if current_user.role == UserRole.FARMER and animal.farm_id != current_user.farm_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    log = (db.query(ConsumptionLog)
             .filter(ConsumptionLog.id == str(log_id),
                     ConsumptionLog.animal_id == str(animal_id))
             .first())
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")
    db.delete(log)
    db.commit()
    return {"status": "success"}

@router.get("/{animal_id}/environment")
async def get_animal_environment(animal_id: UUID, db: Session = Depends(get_db)):
    """Fetches real-time weather and NDVI for an animal's current location.

    Coordinate resolution cascade (real, no hardcoded fallback):
      1. Latest telemetry reading (most recent IoT/satellite fix)
      2. Animal's stored lat/lon (manually set)
      3. Farm centroid (parsed from farm.location)
    If none yields coordinates, returns 422 — better to surface the missing
    data than to silently report Ariana weather to a Sahara animal.
    """
    animal = db.query(Animal).filter(Animal.id == str(animal_id)).first()
    if not animal:
        raise HTTPException(status_code=404, detail="Animal not found")

    latest_telemetry = db.query(AnimalTelemetry).filter(AnimalTelemetry.animal_id == str(animal_id))\
                         .order_by(desc(AnimalTelemetry.time)).first()

    lat = latest_telemetry.latitude  if latest_telemetry and latest_telemetry.latitude  else animal.latitude
    lon = latest_telemetry.longitude if latest_telemetry and latest_telemetry.longitude else animal.longitude
    coord_source = "telemetry" if latest_telemetry and latest_telemetry.latitude else ("animal" if animal.latitude else None)

    if lat is None or lon is None:
        farm = db.query(Farm).filter(Farm.id == animal.farm_id).first()
        if farm and farm.location:
            from ..core.location_utils import parse_coordinates
            coords = parse_coordinates(farm.location)
            if coords:
                lat, lon = coords
                coord_source = "farm"

    if lat is None or lon is None:
        raise HTTPException(
            status_code=422,
            detail=("Coordonnées indisponibles : aucune télémétrie, ni position "
                    "fixe, ni localisation de ferme. Renseignez farm.location ou "
                    "animal.latitude/longitude.")
        )

    weather = await weather_service.get_current_weather(lat, lon)
    ndvi = satellite_service.get_ndvi_for_location(lat, lon)

    raw_temp = weather.get("temperature")
    raw_ndvi = ndvi.get("ndvi_value")

    return {
        "temperature":  float(raw_temp) if raw_temp is not None else None,
        "ndvi":         float(raw_ndvi) if raw_ndvi is not None else None,
        "ndvi_status":  ndvi.get("status", "Unknown"),
        "ndvi_provider": ndvi.get("provider"),
        "weather_stale": bool(weather.get("stale")),
        "ndvi_stale":   bool(ndvi.get("stale")),
        "coord_source": coord_source,
        "coordinates":  {"lat": round(lat, 6), "lon": round(lon, 6)},
        "timestamp":    datetime.now().isoformat()
    }

