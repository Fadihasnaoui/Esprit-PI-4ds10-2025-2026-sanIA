"""
Router — Orbital Scan SVI v9.0
===============================
Endpoint de détection multi-espèces par imagerie satellite.
Pipeline : Fetch ESRI tile mosaic → Gemini Vision + YOLOv8-SAHI-9 → Fusion
Classes  : Bovin 🐄 | Ovin 🐑 | Caprin 🐐 | Cheval 🐴
"""

import math
import io
import logging
from typing import Optional
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests as _http
from PIL import Image as _PILImage

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from ..db.session import get_db
from ..services.svi_service import svi_service
from .deps import get_current_active_user
from ..models.all_models import User, Animal

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Tile helpers ──────────────────────────────────────────────────────────────

def _tile_xyz(lat: float, lon: float, zoom: int = 18):
    """Convert WGS-84 coordinates to ESRI/OSM tile XYZ."""
    n = 2 ** zoom
    x = int((lon + 180) / 360 * n)
    lat_r = math.radians(lat)
    y = int((1 - math.log(math.tan(lat_r) + 1 / math.cos(lat_r)) / math.pi) / 2 * n)
    return zoom, x, y


def _fetch_esri_tile(z: int, x: int, y: int) -> Optional[bytes]:
    """Fetch one ESRI World Imagery tile (256×256 JPEG)."""
    url = (
        f"https://server.arcgisonline.com/ArcGIS/rest/services/"
        f"World_Imagery/MapServer/tile/{z}/{y}/{x}"
    )
    try:
        resp = _http.get(url, timeout=8, headers={"User-Agent": "SVI-AgriSmart/9.0"})
        return resp.content if resp.status_code == 200 else None
    except Exception:
        return None


def _build_tile_mosaic(lat: float, lon: float, zoom: int = 18, grid: int = 3) -> Optional[bytes]:
    """
    Fetch a grid×grid mosaic of ESRI satellite tiles centred on lat/lon.
    Default 3×3 @ zoom 18 → 768×768 px covering ~460 m × ~460 m.
    All tiles are fetched in parallel (ThreadPoolExecutor).
    """
    z, cx, cy = _tile_xyz(lat, lon, zoom)
    offset     = grid // 2
    coords     = [
        (z, cx + dx - offset, cy + dy - offset, dx, dy)
        for dy in range(grid)
        for dx in range(grid)
    ]

    fetched: dict = {}
    with ThreadPoolExecutor(max_workers=grid * grid) as pool:
        future_map = {
            pool.submit(_fetch_esri_tile, z, x, y): (dx, dy)
            for z, x, y, dx, dy in coords
        }
        for fut, (dx, dy) in future_map.items():
            fetched[(dx, dy)] = fut.result()

    canvas  = _PILImage.new("RGB", (256 * grid, 256 * grid), (30, 60, 20))
    got_any = False
    for (dx, dy), data in fetched.items():
        if data:
            try:
                tile = _PILImage.open(io.BytesIO(data)).convert("RGB")
                canvas.paste(tile, (dx * 256, dy * 256))
                got_any = True
            except Exception:
                pass

    if not got_any:
        return None

    buf = io.BytesIO()
    canvas.save(buf, format="JPEG", quality=90)
    return buf.getvalue()


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.post("/orbital-scan")
async def perform_orbital_scan(
    file:         UploadFile = File(None),
    lat:          float      = None,
    lon:          float      = None,
    db:           Session    = Depends(get_db),
    current_user: User       = Depends(get_current_active_user),
):
    """
    Détection multi-espèces par intelligence satellite (SVI v9.0).

    Pipeline : Image → Satellite Preprocessing → Gemini Vision + YOLOv8-SAHI-9-TTA → Fusion

    Modes :
      • Upload fichier     → analyse directe sur l'image fournie
      • Coordonnées GPS    → télécharge la mosaïque satellite ESRI réelle pour ces coords, puis analyse
    """

    # ── 1. Acquire image bytes ────────────────────────────────────────────────
    image_bytes: Optional[bytes] = None
    source_label = "SYNC-FRAME: Manuel Uplink"

    if file:
        image_bytes  = await file.read()
        source_label = "SYNC-FRAME: Manuel Uplink"

    elif lat is not None and lon is not None:
        source_label = f"ORBITAL LOCK: {lat:.5f}, {lon:.5f}"
        logger.info(f"🛰️  Fetching ESRI 3×3 tile mosaic for ({lat:.5f}, {lon:.5f}) …")
        image_bytes = _build_tile_mosaic(lat, lon)

        if image_bytes is None:
            # Last-resort fallback: try the static demo asset
            import os
            for search_dir in [
                os.path.join(os.path.dirname(__file__), "..", "..", "Data", "Raw", "SVI_Assets"),
                os.path.join(os.getcwd(), "Data", "Raw", "SVI_Assets"),
            ]:
                demo = os.path.join(search_dir, "demo_orbital_frame.jpg")
                if os.path.exists(demo):
                    with open(demo, "rb") as f:
                        image_bytes = f.read()
                    source_label += " [demo fallback]"
                    break

        if image_bytes is None:
            raise HTTPException(
                status_code=503,
                detail=(
                    "Impossible de récupérer l'imagerie satellite pour ces coordonnées. "
                    "Vérifiez la connexion réseau ou uploadez une image locale via MANUAL UPLINK."
                ),
            )

    else:
        raise HTTPException(
            status_code=400,
            detail="Fichier image ou coordonnées GPS (lat/lon) requis.",
        )

    # ── 2. Run orbital intelligence pipeline ──────────────────────────────────
    result = svi_service.scan_satellite_image(image_bytes)
    result["source"] = source_label

    if result.get("metadata"):
        result["metadata"]["mode"] = "Manual Classification" if file else "GPS Orbital Scan"

    # ── 3. GPS context enrichment (farm-isolated via JWT) ─────────────────────
    if lat is not None and lon is not None:
        animals = (
            db.query(Animal)
            .filter(Animal.farm_id == current_user.farm_id)
            .all()
        )
        nearby     = None
        best_dist  = float("inf")

        for a in animals:
            if a.latitude is not None and a.longitude is not None:
                d = math.hypot(lat - a.latitude, lon - a.longitude)
                if d < 0.0008 and d < best_dist:   # ≈ 88 m radius
                    nearby    = a
                    best_dist = d

        if nearby:
            dist_m = int(best_dist * 111_320)
            result["source"] = (
                f"GPS LOCK: {lat:.5f},{lon:.5f} "
                f"— {nearby.species} #{nearby.tag_id}"
            )
            meta = result.setdefault("metadata", {})
            meta["gps_animal"]  = f"{nearby.species} #{nearby.tag_id} @ {dist_m}m"
            meta["mode"]        = "GPS Precision Lock"

    if result.get("status") == "error":
        raise HTTPException(
            status_code=500,
            detail=result.get("error", "Erreur interne SVI"),
        )

    return result


@router.get("/status")
def get_svi_status():
    """Retourne le statut du moteur SVI."""
    if not svi_service.initialized:
        svi_service.initialize()
    return {
        "engine":         "SVI AgriSmart v9.0",
        "model":          "Gemini Vision + YOLOv8-SAHI-9-TTA",
        "classes":        ["Bovin", "Ovin", "Caprin", "Cheval"],
        "input_size":     f"{svi_service._input_size}×{svi_service._input_size}",
        "pipeline":       "Satellite Preprocessing + Gemini Primary + YOLOv8 Secondary + Fusion",
        "gemini_enabled": svi_service._gemini_orbital_analysis.__doc__ is not None,
        "status":         "READY" if svi_service.initialized else "AWAITING_MODEL",
    }
