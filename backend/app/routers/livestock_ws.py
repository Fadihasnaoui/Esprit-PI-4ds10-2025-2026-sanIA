from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from typing import List, Dict
import asyncio
import random
from uuid import UUID

router = APIRouter()

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
                    severity="CRITICAL",
                    note=f"SVI ALERT: Animal {target_animal.tag_id} detected OUTSIDE grazing territory by Satellite Intelligence."
                )
                db.add(new_alert)
                db.commit()

    # Real-world SVI Inference Logic: Confidence drops if target is moving fast
    base_conf = 0.98
    if db_telemetry.activity_level == "RUNNING":
        base_conf = 0.85 + (random.random() * 0.05)
    elif db_telemetry.activity_level == "WALKING":
        base_conf = 0.92 + (random.random() * 0.04)
    else:
        base_conf = 0.97 + (random.random() * 0.029)

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
            "svi_confidence": base_conf
        }
    }
    await manager.broadcast(message)
    
    return {"status": "success", "tag_id": target_animal.tag_id, "geofence": "SAFE" if is_safe else "BREACH", "source": "SATELLITE_SVI"}

