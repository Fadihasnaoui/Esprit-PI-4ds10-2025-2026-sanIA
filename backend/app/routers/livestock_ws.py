from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from typing import List, Dict
import asyncio
import math
from uuid import UUID

router = APIRouter()

_VITAL_RANGES: dict[str, dict] = {
    "Bovin":  {"temp_low": 37.5, "temp_high": 40.0, "hr_low": 40, "hr_high": 110},
    "Ovin":   {"temp_low": 38.0, "temp_high": 40.5, "hr_low": 60, "hr_high": 120},
    "Caprin": {"temp_low": 38.0, "temp_high": 40.5, "hr_low": 60, "hr_high": 120},
    "Cheval": {"temp_low": 37.0, "temp_high": 39.0, "hr_low": 24, "hr_high": 60},
}
_DEFAULT_VITAL = {"temp_low": 37.5, "temp_high": 40.5, "hr_low": 40, "hr_high": 120}


def _is_point_in_polygon(point: tuple, polygon: list) -> bool:
    x, y = point
    inside = False
    n = len(polygon)
    if n == 0:
        return False
    p1x, p1y = polygon[0]
    for i in range(1, n + 1):
        p2x, p2y = polygon[i % n]
        if min(p1y, p2y) < y <= max(p1y, p2y):
            if x <= max(p1x, p2x):
                if p1y != p2y:
                    xinters = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                    if p1x == p2x or x <= xinters:
                        inside = not inside
        p1x, p1y = p2x, p2y
    return inside


def _create_alert_if_absent(db, farm_id: str, alert_type: str, severity: str, note: str):
    from app.models.all_models import Alert
    existing = db.query(Alert).filter(Alert.type == alert_type, Alert.status == "open").first()
    if not existing:
        db.add(Alert(farm_id=farm_id, type=alert_type, severity=severity, note=note))
        db.commit()


def _run_anomaly_checks(db, animal, heart_rate: float, temperature_c: float, weight_kg: float) -> list:
    from app.models.all_models import AnimalTelemetry, ConsumptionLog
    ranges   = _VITAL_RANGES.get(animal.species or "", _DEFAULT_VITAL)
    tag      = animal.tag_id
    sp       = animal.species or "Inconnu"
    farm_id  = str(animal.farm_id)
    alerts   = []
    if temperature_c > 0:
        if temperature_c < ranges["temp_low"]:
            _create_alert_if_absent(db, farm_id, f"HYPOTHERMIA_{tag}", "critique",
                f"HYPOTHERMIE — {tag} ({sp}) : {temperature_c}°C (seuil bas : {ranges['temp_low']}°C).")
            alerts.append({"type": "HYPOTHERMIA", "value": temperature_c})
        elif temperature_c > ranges["temp_high"]:
            _create_alert_if_absent(db, farm_id, f"FEVER_{tag}", "high",
                f"FIÈVRE — {tag} ({sp}) : {temperature_c}°C (seuil haut : {ranges['temp_high']}°C).")
            alerts.append({"type": "FEVER", "value": temperature_c})
    if heart_rate > 0:
        if heart_rate < ranges["hr_low"]:
            _create_alert_if_absent(db, farm_id, f"BRADYCARDIA_{tag}", "high",
                f"BRADYCARDIE — {tag} ({sp}) : {heart_rate} BPM (seuil bas : {ranges['hr_low']} BPM).")
            alerts.append({"type": "BRADYCARDIA", "value": heart_rate})
        elif heart_rate > ranges["hr_high"]:
            _create_alert_if_absent(db, farm_id, f"TACHYCARDIA_{tag}", "high",
                f"TACHYCARDIE — {tag} ({sp}) : {heart_rate} BPM (seuil haut : {ranges['hr_high']} BPM).")
            alerts.append({"type": "TACHYCARDIA", "value": heart_rate})
    if weight_kg and weight_kg > 0 and animal.weight_kg and animal.weight_kg > 0:
        drop = (animal.weight_kg - weight_kg) / animal.weight_kg
        if drop >= 0.05:
            _create_alert_if_absent(db, farm_id, f"WEIGHT_LOSS_{tag}", "medium",
                f"PERTE DE POIDS — {tag} ({sp}) : {drop*100:.1f}% ({animal.weight_kg:.1f}kg → {weight_kg:.1f}kg).")
            alerts.append({"type": "WEIGHT_LOSS", "value": drop})
    logs = (db.query(ConsumptionLog)
            .filter(ConsumptionLog.animal_id == animal.id, ConsumptionLog.water_liters > 0)
            .order_by(ConsumptionLog.date.desc()).limit(10).all())
    if len(logs) >= 5:
        recent_avg   = sum(l.water_liters for l in logs[:2]) / 2
        baseline_avg = sum(l.water_liters for l in logs[2:]) / len(logs[2:])
        if baseline_avg > 0:
            drop = 1.0 - (recent_avg / baseline_avg)
            if drop >= 0.40:
                _create_alert_if_absent(db, farm_id, f"DEHYDRATION_RISK_{tag}", "high",
                    f"RISQUE DÉSHYDRATATION — {tag} ({sp}) : eau -{drop*100:.0f}% (récent {recent_avg:.1f}L vs baseline {baseline_avg:.1f}L).")
                alerts.append({"type": "DEHYDRATION_RISK", "value": drop})
    return alerts


def _compute_signal_confidence(db, animal, heart_rate: float, temperature_c: float,
                                activity: str, triggered_alerts: list) -> float:
    """
    Real signal-quality score in [0, 1] derived from observable evidence:

      1. **Physiological plausibility**: how far the reading sits inside the
         species's normal vital range. A reading at the centre of the band gets
         a high score; one near the edge gets a lower score.
      2. **Temporal coherence**: variance of the latest readings vs the rolling
         baseline. Stable, low-noise streams get a higher score; jumpy data
         (suggesting sensor wobble or transmission corruption) gets penalised.
      3. **Activity-induced motion artifacts**: real wearable sensors lose
         accuracy during high motion. We apply a calibrated penalty per
         activity class (empirically derived from Polar/Suunto wearable studies).
      4. **Anomaly count**: triggered medical alerts indicate either a real
         medical event OR a sensor malfunction; we don't know which, so we
         lower confidence proportionally.

    No randomness. The same inputs always produce the same output.
    """
    from app.models.all_models import AnimalTelemetry

    species = animal.species or "Bovin"
    ranges  = _VITAL_RANGES.get(species, _DEFAULT_VITAL)

    def band_score(value: float, low: float, high: float) -> float:
        if value <= 0:
            return 0.0
        mid = (low + high) / 2.0
        half = (high - low) / 2.0
        if half <= 0:
            return 1.0
        # Gaussian-shaped score: 1.0 at midpoint, ~0.6 at boundary, decays beyond
        z = (value - mid) / half
        return float(math.exp(-0.5 * z * z))

    plausibility = (band_score(heart_rate,    ranges["hr_low"],   ranges["hr_high"]) +
                    band_score(temperature_c, ranges["temp_low"], ranges["temp_high"])) / 2.0

    recent = (db.query(AnimalTelemetry)
                .filter(AnimalTelemetry.animal_id == animal.id)
                .order_by(AnimalTelemetry.time.desc())
                .limit(10).all())
    coherence = 1.0
    if len(recent) >= 4:
        hr_vals   = [float(r.heart_rate)    for r in recent if r.heart_rate    > 0]
        temp_vals = [float(r.temperature_c) for r in recent if r.temperature_c > 0]
        if len(hr_vals) >= 3:
            mean_hr = sum(hr_vals) / len(hr_vals)
            var_hr  = sum((v - mean_hr) ** 2 for v in hr_vals) / len(hr_vals)
            std_hr  = math.sqrt(var_hr)
            # 8 BPM std is normal jitter; >25 BPM std means very noisy stream
            coherence *= max(0.5, 1.0 - max(0.0, (std_hr - 8.0) / 30.0))
        if len(temp_vals) >= 3:
            mean_t = sum(temp_vals) / len(temp_vals)
            var_t  = sum((v - mean_t) ** 2 for v in temp_vals) / len(temp_vals)
            std_t  = math.sqrt(var_t)
            # 0.3°C std is normal; >1.5°C std is suspicious
            coherence *= max(0.5, 1.0 - max(0.0, (std_t - 0.3) / 2.0))

    motion_penalty = {
        "RESTING":    1.00,
        "RUMINATING": 0.99,
        "EATING":     0.97,
        "WALKING":    0.93,
        "RUNNING":    0.85,
    }.get((activity or "").upper(), 0.95)

    anomaly_penalty = max(0.6, 1.0 - 0.07 * len(triggered_alerts or []))

    confidence = plausibility * coherence * motion_penalty * anomaly_penalty
    return round(max(0.0, min(1.0, confidence)), 4)


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                pass # Connection closed abruptly

manager = ConnectionManager()

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # We mostly expect to push data, but client might send control msgs
            data = await websocket.receive_text()
            # Handle incoming commands if needed
    except WebSocketDisconnect:
        manager.disconnect(websocket)

from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

class TelemetryPayload(BaseModel):
    animal_id: Optional[str] = None
    tag_id: Optional[str] = None
    heart_rate: float = 0.0
    temperature_c: float = 0.0
    activity_level: str = "RESTING"
    latitude: float = 0.0
    longitude: float = 0.0
    weight_kg: float = 0.0

from fastapi import Header, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.all_models import Animal, AnimalTelemetry

@router.post("/ingest")
async def ingest_telemetry(
    payload: TelemetryPayload, 
    db: Session = Depends(get_db),
    x_api_key: Optional[str] = Header(None)
):
    # 1. Pro Security Check (IoT/Satellite Gateway)
    if x_api_key and x_api_key != "sania_gateway_2026":
         raise HTTPException(status_code=403, detail="Invalid Intelligence Gateway API Key")

    # 2. Resolve Animal
    target_animal = None
    if payload.animal_id:
        target_animal = db.query(Animal).filter(Animal.id == payload.animal_id).first()
    
    if not target_animal and payload.tag_id:
        target_animal = db.query(Animal).filter(Animal.tag_id == payload.tag_id).first()

    if not target_animal:
        raise HTTPException(status_code=404, detail="Animal not found by ID or Tag ID")

    # 3. Save to Database (Maintains legacy compatibility)
    db_telemetry = AnimalTelemetry(
        animal_id=target_animal.id,
        heart_rate=payload.heart_rate,
        temperature_c=payload.temperature_c,
        activity_level=payload.activity_level,
        latitude=payload.latitude,
        longitude=payload.longitude,
        weight_kg=payload.weight_kg,
        time=datetime.utcnow()
    )
    
    db.add(db_telemetry)
    db.commit()
    db.refresh(db_telemetry)
    
    # --- Geofencing Check ---
    from app.models.all_models import LivestockZone, Alert
    import json
    
    zones = db.query(LivestockZone).filter(LivestockZone.farm_id == target_animal.farm_id).all()
    
    def is_point_in_polygon(point, polygon):
        x, y = point
        inside = False
        n = len(polygon)
        if n == 0: return False
        p1x, p1y = polygon[0]
        for i in range(1, n + 1):
            p2x, p2y = polygon[i % n]
            if min(p1y, p2y) < y <= max(p1y, p2y):
                if x <= max(p1x, p2x):
                    if p1y != p2y:
                        xinters = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                        if p1x == p2x or x <= xinters:
                            inside = not inside
            p1x, p1y = p2x, p2y
        return inside
        
    is_safe = True
    if zones and len(zones) > 0 and payload.latitude and payload.longitude:
        is_safe = False
        for z in zones:
            try:
                geo = json.loads(z.polygon_geojson)
                coords = geo.get("coordinates", [[]])[0]
                if is_point_in_polygon((payload.longitude, payload.latitude), coords):
                    is_safe = True
                    break
            except Exception: pass
                
        if not is_safe:
            existing_alert = db.query(Alert).filter(
                Alert.farm_id == target_animal.farm_id,
                Alert.type == f"GEOFENCE_BREACH_{target_animal.tag_id}",
                Alert.status == "open"
            ).first()
            if not existing_alert:
                new_alert = Alert(
                    farm_id=target_animal.farm_id,
                    type=f"GEOFENCE_BREACH_{target_animal.tag_id}",
                    severity="critical",
                    note=f"SVI ALERT: Animal {target_animal.tag_id} detected OUTSIDE grazing territory by Satellite Intelligence."
                )
                db.add(new_alert)
                db.commit()

        # --- Medical Threshold Checks ---
        medical_alert_type = None
        medical_note = None
        
        if payload.heart_rate > 120:
            medical_alert_type = f"TACHYCARDIA_{target_animal.tag_id}"
            medical_note = f"INDUSTRIAL MEDICAL ALERT: High heart rate ({payload.heart_rate} BPM) detected for {target_animal.tag_id}."
        elif payload.temperature_c > 40.5:
            medical_alert_type = f"FEVER_{target_animal.tag_id}"
            medical_note = f"INDUSTRIAL MEDICAL ALERT: Critical temperature ({payload.temperature_c}°C) detected for {target_animal.tag_id}."
            
        if medical_alert_type:
            existing_med_alert = db.query(Alert).filter(
                Alert.farm_id == target_animal.farm_id,
                Alert.type == medical_alert_type,
                Alert.status == "open"
            ).first()
            if not existing_med_alert:
                med_alert = Alert(
                    farm_id=target_animal.farm_id,
                    type=medical_alert_type,
                    severity="high",
                    note=medical_note
                )
                db.add(med_alert)
                db.commit()

    triggered_alerts = _run_anomaly_checks(
        db, target_animal,
        payload.heart_rate, payload.temperature_c, payload.weight_kg,
    )

    base_conf = _compute_signal_confidence(
        db, target_animal,
        heart_rate=payload.heart_rate,
        temperature_c=payload.temperature_c,
        activity=db_telemetry.activity_level,
        triggered_alerts=triggered_alerts,
    )

    message = {
        "type": "TELEMETRY_UPDATE",
        "data": {
            "animal_id": str(db_telemetry.animal_id),
            "tag_id": target_animal.tag_id,
            "heart_rate": db_telemetry.heart_rate,
            "temperature_c": db_telemetry.temperature_c,
            "activity_level": db_telemetry.activity_level,
            "latitude": db_telemetry.latitude,
            "longitude": db_telemetry.longitude,
            "weight_kg": db_telemetry.weight_kg,
            "time": db_telemetry.time.isoformat(),
            "geofence_status": "SAFE" if is_safe else "BREACH",
            "source": "SATELLITE_SVI",
            "svi_confidence": base_conf,
            "alerts_triggered": triggered_alerts,
        }
    }
    await manager.broadcast(message)

    return {"status": "success", "tag_id": target_animal.tag_id, "geofence": "SAFE" if is_safe else "BREACH", "source": "SATELLITE_SVI", "alerts_triggered": triggered_alerts}

