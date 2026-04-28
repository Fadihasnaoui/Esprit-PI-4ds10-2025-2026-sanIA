"""
Insights Router — Dynamic intelligence endpoints
================================================
- GET /insights/heat-stress        → 72h THI forecast for the farm
- GET /insights/market-prices      → live price context (FX + seasonal)
- GET /insights/market-prices/{animal_id} → per-animal dynamic valuation
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..db.session import get_db
from ..models.all_models import User, Animal
from .deps import get_current_active_user
from ..services.heat_stress_service import forecast as heat_forecast
from ..services.market_price_service import (
    get_price_context,
    compute_animal_price,
)

router = APIRouter()


def _farm_center(db: Session, farm_id: str) -> tuple[float, float]:
    """Centroid of animals (lat, lon); fallback to Tunis region."""
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
    return 36.60, 10.49


@router.get("/heat-stress")
def get_heat_stress(
    species: str = Query("Bovin", description="Espèce pour ajuster les seuils THI"),
    hours:   int = Query(72, ge=6, le=120, description="Horizon en heures (6–120)"),
    db:      Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Live 72h THI forecast for the authenticated farmer's farm.
    Uses OpenMeteo (free, no API key) → temperature + humidity → THI.
    """
    if not current_user.farm_id:
        raise HTTPException(status_code=400, detail="Aucune ferme associée à ce compte.")
    lat, lon = _farm_center(db, current_user.farm_id)
    data = heat_forecast(lat, lon, species=species, hours=hours)
    data["farm_center"] = {"lat": round(lat, 6), "lon": round(lon, 6)}
    return data


@router.get("/market-prices")
def get_market_prices(
    current_user: User = Depends(get_current_active_user),
):
    """
    Current live market context — exchange rate + seasonal multipliers.
    Used to display a global banner (e.g., 'Aïd al-Adha active: ovins +35%').
    """
    return get_price_context()


@router.get("/market-prices/{animal_id}")
def get_animal_market_price(
    animal_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Dynamic per-animal valuation (TND) reflecting:
    base species price × FX factor × seasonal event × age × weight × health.
    """
    if not current_user.farm_id:
        raise HTTPException(status_code=400, detail="Aucune ferme associée à ce compte.")

    animal = (
        db.query(Animal)
        .filter(Animal.id == animal_id, Animal.farm_id == current_user.farm_id)
        .first()
    )
    if not animal:
        raise HTTPException(status_code=404, detail="Animal introuvable.")

    valuation = compute_animal_price(
        species       = animal.species or "Bovin",
        birth_date    = animal.birth_date,
        weight_kg     = animal.weight_kg,
        health_status = animal.status,
    )
    return {
        "animal_id":   animal.id,
        "tag_id":      animal.tag_id,
        "species":     animal.species,
        **valuation,
    }
