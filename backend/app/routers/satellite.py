from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db.session import get_db
from ..models.all_models import Animal, LivestockZone, User, UserRole
from .deps import get_current_active_user
from ..services.sentinel_service import sentinel_service

router = APIRouter()


def _get_farm_center(db: Session, farm_id: str):
    """Returns (lat, lon) centroid of animals in the farm, or Tunisia default."""
    animals = (
        db.query(Animal)
        .filter(
            Animal.farm_id == farm_id,
            Animal.latitude.isnot(None),
            Animal.longitude.isnot(None),
        )
        .all()
    )
    if animals:
        return (
            sum(a.latitude for a in animals) / len(animals),
            sum(a.longitude for a in animals) / len(animals),
        )
    return 36.60, 10.49  # default: Tunis region


@router.get("/zones-health")
def get_zones_health(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Returns Sentinel-2 scene metadata + NDVI health score for every
    geofence zone belonging to the authenticated farmer's farm.
    Also returns the NASA GIBS MODIS NDVI tile URL ready for Leaflet.
    Data is isolated per farmer — a user only sees their own farm's zones.
    """
    farm_id = current_user.farm_id
    if not farm_id:
        # Cooperative admins without a direct farm assignment
        raise HTTPException(
            status_code=400,
            detail="Aucune ferme associée à ce compte. Contactez votre administrateur.",
        )

    lat, lon = _get_farm_center(db, farm_id)

    zones = (
        db.query(LivestockZone)
        .filter(LivestockZone.farm_id == farm_id)
        .all()
    )

    result = sentinel_service.analyze_zones(zones, lat, lon)
    result["farm_center"] = {"lat": round(lat, 6), "lon": round(lon, 6)}
    return result


@router.get("/scene-info")
def get_scene_info(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Returns the latest Sentinel-2 L2A scene metadata for the current farm.
    Useful for showing acquisition date and cloud cover in the UI.
    """
    farm_id = current_user.farm_id
    if not farm_id:
        raise HTTPException(status_code=400, detail="Aucune ferme associée à ce compte.")

    lat, lon = _get_farm_center(db, farm_id)
    scene = sentinel_service.search_latest_scene(lat, lon)

    if not scene:
        return {
            "available": False,
            "message": "Aucune scène récente trouvée (couverture nuageuse > 45% ou zone non couverte)",
            "ndvi_tile_url": sentinel_service.get_ndvi_tile_url(),
            "ndvi_tile_date": sentinel_service.get_modis_ndvi_tile_date(),
        }

    return {
        "available": True,
        "ndvi_tile_url": sentinel_service.get_ndvi_tile_url(),
        "ndvi_tile_date": sentinel_service.get_modis_ndvi_tile_date(),
        **scene,
    }
