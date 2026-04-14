"""
VRA Router — Variable Rate Application + Soil Health + Crop Calendar
Pillar 2: Satellite Data → Actionable Intelligence
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID

from ..db.session import get_db
from ..models.all_models import Field, User, UserRole
from .deps import get_current_active_user
from ..services.vra_service import generate_vra_map, get_soil_health, get_crop_calendar
from ..services.ndvi_diagnostic import ndvi_diagnostic_service

router = APIRouter()


def _get_field_authorized(field_id: UUID, db: Session, current_user: User) -> Field:
    """Shared helper: fetch field and check ownership."""
    field = db.query(Field).filter(Field.id == field_id).first()
    if not field:
        raise HTTPException(status_code=404, detail="Field not found")
    if current_user.role == UserRole.FARMER and field.farm_id != current_user.farm_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    return field


def _fetch_ndvi_data(field: Field, db: Session) -> dict | None:
    """Fetch live NDVI diagnostic from satellite API (best-effort)."""
    if not field.polygon_geojson or field.polygon_geojson == "[]":
        return None
    try:
        return ndvi_diagnostic_service.get_real_diagnostic(db, field.id, field.polygon_geojson)
    except Exception:
        return None


# ─── VRA Map ──────────────────────────────────────────────────────────────────

@router.get("/{field_id}/map")
def get_vra_map(
    field_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Generate a Variable Rate Application (VRA) prescription map for the field.

    Returns three management zones (High / Medium / Low need) with:
    - Zone area and percentage of total field
    - Fertilizer prescription (N, P, K in kg)
    - Water prescription (m³)
    - Application rate percentage
    - Estimated input savings vs uniform application
    """
    field = _get_field_authorized(field_id, db, current_user)
    ndvi_data = _fetch_ndvi_data(field, db)
    return generate_vra_map(db, field, ndvi_data)


# ─── Soil Health ──────────────────────────────────────────────────────────────

@router.get("/{field_id}/soil-health")
def get_field_soil_health(
    field_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Compute soil health indicators for the field.

    Returns:
    - NDVI, SAVI, MSAVI vegetation indices
    - EVI-based moisture stress index
    - Soil fertility classification
    - Overall health score (0–100) with label
    - Actionable recommendations
    """
    field = _get_field_authorized(field_id, db, current_user)
    ndvi_data = _fetch_ndvi_data(field, db)
    return get_soil_health(db, field, ndvi_data)


# ─── Crop Calendar ────────────────────────────────────────────────────────────

@router.get("/{field_id}/crop-calendar")
def get_field_crop_calendar(
    field_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Generate an AI-driven crop calendar for the field.

    Returns:
    - Current growth stage name and recommended action
    - NDVI vs expected NDVI assessment
    - Full season timeline with status (completed / current / upcoming)
    - Upcoming critical actions (next 3 stages)
    - Overall season progress percentage
    """
    field = _get_field_authorized(field_id, db, current_user)
    ndvi_data = _fetch_ndvi_data(field, db)
    return get_crop_calendar(db, field, ndvi_data)


# ─── Combined Full Analysis ───────────────────────────────────────────────────

@router.get("/{field_id}/full-analysis")
def get_full_satellite_analysis(
    field_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Full Pillar 2 satellite analysis in a single call (mobile-optimized).

    Returns NDVI diagnostic + VRA map + soil health + crop calendar combined.
    The satellite API is called exactly ONCE and the result is shared across
    all sub-services to avoid redundant round-trips.
    Also exposes a flat `ndvi_summary` block at the top level for easy
    Dashboard consumption (avg_ndvi, health_label, date, clouds).
    """
    field = _get_field_authorized(field_id, db, current_user)

    # ── ONE satellite call, shared by all sub-services ──
    ndvi_data = _fetch_ndvi_data(field, db)

    vra_map      = generate_vra_map(db, field, ndvi_data)
    soil_health  = get_soil_health(db, field, ndvi_data)
    crop_calendar = get_crop_calendar(db, field, ndvi_data)

    # ── Flat ndvi_summary for Dashboard quick-read ──
    diag_sum = (ndvi_data or {}).get("summary", {})
    avg_ndvi = diag_sum.get("avg_ndvi")
    if avg_ndvi is None:
        avg_ndvi = vra_map.get("avg_ndvi")  # already resolved by vra_service

    ndvi_summary = {
        "avg_ndvi":     avg_ndvi,
        "health_label": diag_sum.get("health_label") or soil_health.get("health_label"),
        "health_score": soil_health.get("health_score"),
        "date":         diag_sum.get("date"),
        "clouds":       diag_sum.get("clouds"),
        "source":       diag_sum.get("source", "Sentinel-2 L2A"),
        "ndvi_label":   (
            "Excellent" if (avg_ndvi or 0) >= 0.6 else
            "Bon"       if (avg_ndvi or 0) >= 0.4 else
            "Modéré"    if (avg_ndvi or 0) >= 0.2 else
            "Faible"
        ) if avg_ndvi is not None else "N/A",
    }

    return {
        "field_id":      str(field.id),
        "field_name":    field.name,
        "crop_type":     field.crop_type,
        "area_ha":       field.area_ha,
        "ndvi_summary":  ndvi_summary,          # ← flat, easy to read
        "ndvi_diagnostic": ndvi_data,
        "vra_map":         vra_map,
        "soil_health":     soil_health,
        "crop_calendar":   crop_calendar,
    }
