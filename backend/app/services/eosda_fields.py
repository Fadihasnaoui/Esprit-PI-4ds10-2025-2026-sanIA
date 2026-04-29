"""
EOSDA Field Management API — register / sync Sania fields so they appear
in the EOSDA "My Fields" dashboard (api-connect.eos.com/user-dashboard/fields).

Endpoint: POST/PATCH/DELETE https://api-connect.eos.com/field-management
Docs: https://doc.eos.com/docs/field-management-api/field-management/

Coordinates: EOSDA uses [longitude, latitude] order.
Sania stores [[lat, lng], ...] — conversion is done here.
"""
from __future__ import annotations

import json
import logging
from typing import Any

import requests

from app.core.config import settings

logger = logging.getLogger(__name__)

EOSDA_FM_BASE = "https://api-connect.eos.com/field-management"


def _api_key() -> str | None:
    return (getattr(settings, "EOSDA_API_KEY", None) or "").strip() or None


def _sania_coords_to_geojson_ring(coords: list[list[float]]) -> list[list[float]]:
    """Sania: [[lat, lng], ...]  →  GeoJSON: [[lng, lat], ...]"""
    ring = [[c[1], c[0]] for c in coords]
    if ring[0] != ring[-1]:
        ring.append(ring[0])
    return ring


def register_field_in_eosda(
    sania_field_id: str,
    field_name: str,
    crop_type: str | None,
    polygon_geojson: str | None,
    existing_eosda_id: int | None = None,
) -> int | None:
    """
    Create or update the field in EOSDA Field Management.
    Returns the EOSDA field ID (integer) on success, None on failure.
    """
    key = _api_key()
    if not key:
        logger.warning("[EOSDA-FM] EOSDA_API_KEY not set — skipping field sync")
        return existing_eosda_id

    if not polygon_geojson:
        logger.warning("[EOSDA-FM] field %s has no polygon — skipping", sania_field_id)
        return existing_eosda_id

    try:
        raw_coords = json.loads(polygon_geojson)
        if not raw_coords or len(raw_coords) < 3:
            return existing_eosda_id
        ring = _sania_coords_to_geojson_ring(raw_coords)
    except Exception as exc:
        logger.error("[EOSDA-FM] bad polygon for field %s: %s", sania_field_id, exc)
        return existing_eosda_id

    import datetime
    year = datetime.date.today().year

    # EOSDA accepts only specific crop type strings — skip it to avoid 400 errors.
    # The field name and geometry are what matter for the My Fields dashboard.
    body: dict[str, Any] = {
        "type": "Feature",
        "properties": {
            "name": field_name,
            "group": "Sania",
        },
        "geometry": {
            "type": "Polygon",
            "coordinates": [ring],
        },
    }

    try:
        if existing_eosda_id:
            # Update existing EOSDA field
            resp = requests.patch(
                f"{EOSDA_FM_BASE}/{existing_eosda_id}?api_key={key}",
                json=body,
                timeout=20,
            )
        else:
            # Create new EOSDA field
            resp = requests.post(
                f"{EOSDA_FM_BASE}?api_key={key}",
                json=body,
                timeout=20,
            )

        if resp.status_code in (200, 201):
            data = resp.json()
            eosda_id = data.get("id") or existing_eosda_id
            logger.info(
                "[EOSDA-FM] field '%s' synced → EOSDA id=%s",
                field_name, eosda_id,
            )
            return int(eosda_id) if eosda_id else existing_eosda_id
        else:
            logger.warning(
                "[EOSDA-FM] field '%s' sync failed: %d %s",
                field_name, resp.status_code, resp.text[:200],
            )
            return existing_eosda_id

    except Exception as exc:
        logger.error("[EOSDA-FM] field '%s' sync error: %s", field_name, exc)
        return existing_eosda_id


def delete_field_from_eosda(eosda_field_id: int) -> bool:
    """Remove field from EOSDA. Returns True on success."""
    key = _api_key()
    if not key or not eosda_field_id:
        return False
    try:
        resp = requests.delete(
            f"{EOSDA_FM_BASE}/{eosda_field_id}?api_key={key}",
            timeout=20,
        )
        if resp.status_code in (200, 204):
            logger.info("[EOSDA-FM] deleted EOSDA field %s", eosda_field_id)
            return True
        logger.warning("[EOSDA-FM] delete failed: %d %s", resp.status_code, resp.text[:100])
        return False
    except Exception as exc:
        logger.error("[EOSDA-FM] delete error: %s", exc)
        return False
