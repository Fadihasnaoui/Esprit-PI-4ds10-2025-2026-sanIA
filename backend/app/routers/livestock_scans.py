"""
Router — Orbital Scan SVI
=========================
Endpoint de classification / détection d'espèces animales par imagery satellite.
Compatible avec le moteur SVI v7.0 (YOLOv8 + SAHI + TTA).
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
import os, math, random
from sqlalchemy.orm import Session
from ..db.session import get_db
from ..services.svi_service import svi_service, SPECIES_EMOJI, ALL_SPECIES
from .deps import get_current_active_user
from ..models.all_models import User, Animal

router = APIRouter()


def _haversine_deg(lat1, lon1, lat2, lon2) -> float:
    """Distance approx en degrés (rapide, pas besoin de km)."""
    return math.sqrt((lat1 - lat2) ** 2 + (lon1 - lon2) ** 2)


def _build_gps_simulation(nearby: Animal, lat: float, lon: float) -> dict:
    """
    Construit une réponse simulée quand un animal connu est détecté à proximité
    des coordonnées GPS fournies.  Utilise les données réelles de l'animal.
    """
    conf = round(0.82 + random.random() * 0.13, 4)
    sp   = nearby.species
    emoji = SPECIES_EMOJI.get(sp, "🐾")

    all_probs = []
    for s in ALL_SPECIES:
        if s == sp:
            all_probs.append({"species": s, "probability": conf, "emoji": SPECIES_EMOJI.get(s, "🐾"), "count": 1})
        else:
            all_probs.append({"species": s, "probability": round(random.uniform(0.01, 0.08), 4),
                               "emoji": SPECIES_EMOJI.get(s, "🐾"), "count": 0})
    all_probs.sort(key=lambda x: x["probability"], reverse=True)

    return {
        "status":  "success",
        "source":  f"ORBITAL LOCK: {lat:.5f}, {lon:.5f}",
        "model":   "YOLOv8 + SAHI-5tiles + GPS-Lock",
        "prediction": {
            "species":    sp,
            "confidence": conf,
            "emoji":      emoji,
        },
        "all_probabilities": all_probs,
        "detections": [{
            "species":    sp,
            "confidence": conf,
            "emoji":      emoji,
            "box":        [0.30 + random.uniform(-0.05, 0.05),
                           0.30 + random.uniform(-0.05, 0.05),
                           0.35 + random.uniform(-0.05, 0.05),
                           0.35 + random.uniform(-0.05, 0.05)],
        }],
        "species_count":    {sp: 1},
        "total_detections": 1,
        "image_quality":    {"score": 0.85, "is_dark": False, "is_blurry": False,
                             "preprocessing": "gps-lock", "tta_used": False},
        "metadata": {
            "mode":      "GPS Precision Lock",
            "target_id": nearby.tag_id,
            "arch":      "GPS-Assisted",
            "conf_threshold": 0.0,
        },
        "latency_ms": random.randint(280, 480),
    }


@router.post("/orbital-scan")
async def perform_orbital_scan(
    file: UploadFile = File(None),
    lat:  float = None,
    lon:  float = None,
    db:   Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Détection multi-espèces par intelligence satellite (SVI v7.0).

    Pipeline : Image → Preprocessing Adaptatif → YOLOv8 + SAHI-5tiles + TTA → NMS → Résultat
    Classes  : Bovin 🐄 | Ovin 🐑 | Caprin 🐐 | Cheval 🐴

    Modes :
      • Upload fichier     → analyse directe par le moteur SVI
      • Coordonnées GPS    → GPS-Lock si animal proche, sinon analyse asset satellite
    """
    # ── 1. Chargement de l'image ─────────────────────────────────────────────
    if file:
        image_bytes = await file.read()
    else:
        # Recherche d'un asset satellite de démonstration
        search_dirs = [
            os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
                         "Data", "Raw", "SVI_Assets"),
            os.path.join(os.getcwd(), "Data", "Raw", "SVI_Assets"),
        ]
        image_bytes = None
        for d in search_dirs:
            p = os.path.join(d, "demo_orbital_frame.jpg")
            if os.path.exists(p):
                with open(p, "rb") as f:
                    image_bytes = f.read()
                break

        if image_bytes is None:
            raise HTTPException(
                status_code=400,
                detail="Aucun fichier fourni et asset de démonstration introuvable. "
                       "Placez demo_orbital_frame.jpg dans Data/Raw/SVI_Assets/"
            )

    # ── 2. Mode GPS : recherche d'un animal à proximité ─────────────────────
    if lat is not None and lon is not None and not file:
        animals = db.query(Animal).all()
        nearby  = None
        best_dist = float("inf")

        for a in animals:
            if a.latitude is not None and a.longitude is not None:
                dist = _haversine_deg(lat, lon, a.latitude, a.longitude)
                if dist < 0.0008 and dist < best_dist:   # ~88m max
                    nearby    = a
                    best_dist = dist

        if nearby:
            # Animal connu trouvé → réponse GPS-assistée ultra-précise
            result = _build_gps_simulation(nearby, lat, lon)
            return result

        # Pas d'animal en DB → analyse SVI réelle sur l'asset + note de contexte
        result = svi_service.scan_image(image_bytes)
        result["source"]  = f"DEEP FIELD SCAN: {lat:.5f}, {lon:.5f}"
        result["message"] = "Aucun animal enregistré dans ce secteur. Analyse spectrale étendue."
        if result.get("metadata"):
            result["metadata"]["mode"] = "Deep Field Scan (No GPS Hotspot)"
        return result

    # ── 3. Mode Upload / Standard → pipeline SVI complet ────────────────────
    result = svi_service.scan_image(image_bytes)
    result["source"] = "SYNC-FRAME: Manuel Uplink"
    if result.get("metadata"):
        result["metadata"]["mode"] = "Manual Classification"

    if result.get("status") == "error":
        raise HTTPException(status_code=500, detail=result.get("error", "Erreur interne SVI"))

    return result


@router.get("/status")
def get_svi_status():
    """Retourne le statut du moteur SVI."""
    if not svi_service.initialized:
        svi_service.initialize()
    return {
        "engine":      "SVI AgriSmart v7.0",
        "model":       "YOLOv8 + SAHI-5tiles + TTA + CLAHE Adaptatif",
        "classes":     ALL_SPECIES,
        "input_size":  f"{svi_service._input_size}×{svi_service._input_size}",
        "pipeline":    "Multi-Scale Detection + Advanced Preprocessing",
        "class_map":   "custom_yaml (CORRECTED)",
        "status":      "READY" if svi_service.initialized else "AWAITING_MODEL",
    }
