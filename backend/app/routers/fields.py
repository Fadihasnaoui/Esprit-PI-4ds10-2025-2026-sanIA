import logging
from fastapi import APIRouter, Depends, HTTPException  # type: ignore
from sqlalchemy.orm import Session  # type: ignore
from typing import List
from ..db.session import get_db  # type: ignore
from ..models.all_models import Field, User, UserRole, IrrigationLog  # type: ignore
from ..schemas.field import FieldCreate, FieldInDB, FieldUpdate  # type: ignore
from ..schemas.sensors import IrrigationLogCreate, IrrigationLogInDB  # type: ignore
from .deps import get_current_active_user  # type: ignore
from ..services.ndvi_diagnostic import NDVIDiagnosticService
from ..services.eosda_fields import register_field_in_eosda, delete_field_from_eosda
from uuid import UUID
import threading

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/", response_model=List[FieldInDB])
def read_fields(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = db.query(Field)
    if current_user.role == UserRole.FARMER:
        query = query.filter(Field.farm_id == current_user.farm_id)
    return query.all()

@router.post("/", response_model=FieldInDB)
def create_field(
    field_in: FieldCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    if current_user.role == UserRole.FARMER and field_in.farm_id != current_user.farm_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    db_field = Field(**field_in.dict())
    db.add(db_field)
    db.commit()
    db.refresh(db_field)

    # Register in EOSDA in background (non-blocking)
    def _sync_eosda(field_id, name, crop, polygon, existing_eid):
        from app.db.session import SessionLocal
        eid = register_field_in_eosda(str(field_id), name, crop, polygon, existing_eid)
        if eid:
            try:
                _db = SessionLocal()
                _f = _db.query(Field).filter(Field.id == field_id).first()
                if _f:
                    _f.eosda_field_id = eid
                    _db.commit()
            except Exception as e:
                logger.error("[EOSDA-FM] could not save eosda_field_id: %s", e)
            finally:
                _db.close()

    threading.Thread(
        target=_sync_eosda,
        args=(db_field.id, db_field.name, db_field.crop_type,
              db_field.polygon_geojson, db_field.eosda_field_id),
        daemon=True,
    ).start()

    try:
        NDVIDiagnosticService.sync_field_polygon_to_agromonitoring(
            db_field.id, db_field.polygon_geojson
        )
    except Exception:
        pass
    return db_field

@router.put("/{field_id}", response_model=FieldInDB)
def update_field(
    field_id: UUID,
    field_in: FieldUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    db_field = db.query(Field).filter(Field.id == field_id).first()
    if not db_field:
        raise HTTPException(status_code=404, detail="Field not found")
    if current_user.role == UserRole.FARMER and db_field.farm_id != current_user.farm_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = field_in.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_field, key, value)
        
    db.commit()
    db.refresh(db_field)

    # Re-sync to EOSDA in background whenever name, crop or polygon changes
    if any(k in update_data for k in ("name", "crop_type", "polygon_geojson")):
        def _update_eosda(field_id, name, crop, polygon, existing_eid):
            from app.db.session import SessionLocal
            eid = register_field_in_eosda(str(field_id), name, crop, polygon, existing_eid)
            if eid and eid != existing_eid:
                try:
                    _db = SessionLocal()
                    _f = _db.query(Field).filter(Field.id == field_id).first()
                    if _f:
                        _f.eosda_field_id = eid
                        _db.commit()
                except Exception as e:
                    logger.error("[EOSDA-FM] could not save eosda_field_id on update: %s", e)
                finally:
                    _db.close()

        threading.Thread(
            target=_update_eosda,
            args=(db_field.id, db_field.name, db_field.crop_type,
                  db_field.polygon_geojson, db_field.eosda_field_id),
            daemon=True,
        ).start()

    if "polygon_geojson" in update_data:
        try:
            NDVIDiagnosticService.sync_field_polygon_to_agromonitoring(
                db_field.id, db_field.polygon_geojson
            )
        except Exception:
            pass
    return db_field


@router.get("/agromonitoring-status")
def agromonitoring_remote_status(
    current_user: User = Depends(get_current_active_user),
):
    """
    Debug: how many polygons exist on Agromonitoring for the API key in backend/.env.
    Does not expose the key. If count is 0 after creating a parcel, the key is wrong, quota full, or sync failed (see server logs).
    """
    from app.core.config import settings
    import requests

    prov = (getattr(settings, "NDVI_PROVIDER", None) or "eosda").strip().lower()
    if prov in ("eosda", "eos", "planetary_stac", "planetary", "stac", "pc", "sentinel_stac"):
        provider_label = {
            "eosda": "EOSDA API Connect (Sentinel-2 L2A)",
            "eos": "EOSDA API Connect (Sentinel-2 L2A)",
            "planetary_stac": "Microsoft Planetary Computer (STAC)",
        }.get(prov, prov)
        return {
            "ndvi_provider": prov,
            "provider_label": provider_label,
            "remote_polygon_registration": "not_used",
            "message": f"NDVI via {provider_label}. Aucun polygone distant necessaire — calcul serveur a la demande.",
        }

    key = (settings.AGROMONITORING_API_KEY or "").strip()
    if not key:
        return {
            "api_key_configured": False,
            "remote_polygon_count": None,
            "message": "Set AGROMONITORING_API_KEY in backend/.env (same key as API KEYS on agromonitoring.com).",
        }
    url = f"https://api.agromonitoring.com/agro/1.0/polygons?appid={key}"
    try:
        r = requests.get(url, timeout=20)
        if r.status_code == 401:
            return {
                "api_key_configured": True,
                "key_valid": False,
                "remote_polygon_count": 0,
                "message": "401 — clé invalide ou compte non activé. Copiez la clé depuis agromonitoring.com → API KEYS.",
            }
        if r.status_code != 200:
            return {
                "api_key_configured": True,
                "http_status": r.status_code,
                "message": r.text[:300],
            }
        polys = r.json()
        n = len(polys) if isinstance(polys, list) else 0
        names = [p.get("name") for p in polys[:8]] if isinstance(polys, list) else []
        return {
            "api_key_configured": True,
            "key_valid": True,
            "remote_polygon_count": n,
            "polygon_names_sample": names,
            "message": "Si vous créez une parcelle dans Sania et que ce nombre reste 0, regardez les logs [Agro] ou vérifiez le quota sur le site Agromonitoring.",
        }
    except Exception as e:
        return {"api_key_configured": True, "error": str(e)}

@router.delete("/{field_id}", response_model=dict)
def delete_field(
    field_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    db_field = db.query(Field).filter(Field.id == field_id).first()
    if not db_field:
        raise HTTPException(status_code=404, detail="Field not found")
    if current_user.role == UserRole.FARMER and db_field.farm_id != current_user.farm_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    eosda_id = db_field.eosda_field_id
    db.delete(db_field)
    db.commit()
    if eosda_id:
        threading.Thread(
            target=delete_field_from_eosda, args=(eosda_id,), daemon=True
        ).start()
    return {"message": "Field deleted successfully"}

@router.get("/{id}/irrigation-logs", response_model=List[IrrigationLogInDB])
def read_irrigation_logs(id: UUID, db: Session = Depends(get_db)):
    return db.query(IrrigationLog).filter(IrrigationLog.field_id == id).all()
