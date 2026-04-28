"""
Heat Stress Service — THI forecasting via OpenMeteo
===================================================
Pulls live hourly temperature + relative humidity for the farm's center,
computes the Temperature-Humidity Index (THI), and returns a per-animal
stress forecast on a 72-hour horizon.

THI formula (NRC 1971, standard for dairy cattle):
    THI = (1.8 * T_c + 32) - ((0.55 - 0.0055 * RH) * (1.8 * T_c - 26))

Thresholds (dairy cattle reference, adjusted for each species):
    < 72  Normal
    72–79 Mild stress
    80–89 Moderate stress (milk drop, feed intake drop)
    ≥ 90  Severe stress (risk of mortality)

No API key required — OpenMeteo is free, no auth, global coverage.
"""

import time
import logging
from typing import Optional

import requests as _http

logger = logging.getLogger(__name__)

# 10-minute in-memory cache to spare OpenMeteo and stay snappy
_CACHE_TTL = 600
_cache: dict = {}

# Species-specific THI thresholds (mild, moderate, severe).
# Horses and sheep tolerate heat slightly better than dairy cattle.
_SPECIES_THRESHOLDS = {
    "Bovin":  {"mild": 72, "moderate": 80, "severe": 90},
    "Ovin":   {"mild": 75, "moderate": 82, "severe": 92},
    "Caprin": {"mild": 76, "moderate": 83, "severe": 93},
    "Cheval": {"mild": 74, "moderate": 81, "severe": 91},
}


def _compute_thi(temp_c: float, rh: float) -> float:
    """Return THI from temperature (°C) and relative humidity (0–100)."""
    return (1.8 * temp_c + 32) - ((0.55 - 0.0055 * rh) * (1.8 * temp_c - 26))


def _severity_label(thi: float, species: str = "Bovin") -> str:
    t = _SPECIES_THRESHOLDS.get(species, _SPECIES_THRESHOLDS["Bovin"])
    if thi >= t["severe"]:   return "SEVERE"
    if thi >= t["moderate"]: return "MODERATE"
    if thi >= t["mild"]:     return "MILD"
    return "NORMAL"


def forecast(lat: float, lon: float, species: str = "Bovin", hours: int = 72) -> dict:
    """
    Fetch live hourly forecast from OpenMeteo and return:
      - current_thi + severity
      - peak_thi_next_72h + when + severity
      - alert_level (highest severity in forecast window)
      - hours_above_moderate (total count of stressful hours)
      - per-hour list for frontend charts
    """
    cache_key = f"{round(lat, 3)}:{round(lon, 3)}:{species}:{hours}"
    now = time.time()
    cached = _cache.get(cache_key)
    if cached and cached["_ts"] > now - _CACHE_TTL:
        return {k: v for k, v in cached.items() if k != "_ts"}

    try:
        resp = _http.get(
            "https://api.open-meteo.com/v1/forecast",
            params={
                "latitude":  lat,
                "longitude": lon,
                "hourly":    "temperature_2m,relative_humidity_2m",
                "forecast_days": max(1, min(16, (hours // 24) + 1)),
                "timezone":  "auto",
            },
            timeout=8,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:
        logger.warning(f"⚠️  OpenMeteo fetch failed: {exc}")
        return {
            "available": False,
            "error":     f"Service météo indisponible: {exc}",
            "species":   species,
        }

    times    = data.get("hourly", {}).get("time", []) or []
    temps    = data.get("hourly", {}).get("temperature_2m", []) or []
    humids   = data.get("hourly", {}).get("relative_humidity_2m", []) or []

    if not times or not temps or not humids:
        return {"available": False, "error": "Données météo incomplètes", "species": species}

    # Truncate to the requested horizon
    horizon = min(hours, len(times))
    hourly: list[dict] = []
    peak_thi  = -1.0
    peak_when: Optional[str] = None
    stress_hours = 0
    worst_severity = "NORMAL"
    severity_rank = {"NORMAL": 0, "MILD": 1, "MODERATE": 2, "SEVERE": 3}

    for i in range(horizon):
        t_c = float(temps[i])
        rh  = float(humids[i])
        thi = round(_compute_thi(t_c, rh), 1)
        sev = _severity_label(thi, species)

        if sev in ("MODERATE", "SEVERE"):
            stress_hours += 1
        if severity_rank[sev] > severity_rank[worst_severity]:
            worst_severity = sev
        if thi > peak_thi:
            peak_thi  = thi
            peak_when = times[i]

        hourly.append({
            "time":     times[i],
            "temp_c":   round(t_c, 1),
            "rh_pct":   round(rh, 0),
            "thi":      thi,
            "severity": sev,
        })

    current = hourly[0]
    thresholds = _SPECIES_THRESHOLDS.get(species, _SPECIES_THRESHOLDS["Bovin"])

    result = {
        "available": True,
        "species":   species,
        "thresholds": thresholds,
        "current": {
            "time":     current["time"],
            "temp_c":   current["temp_c"],
            "rh_pct":   current["rh_pct"],
            "thi":      current["thi"],
            "severity": current["severity"],
        },
        "peak": {
            "thi":      round(peak_thi, 1),
            "when":     peak_when,
            "severity": _severity_label(peak_thi, species),
        },
        "alert_level":          worst_severity,
        "hours_above_moderate": stress_hours,
        "horizon_hours":        horizon,
        "hourly":               hourly,
        "advice":               _advice(worst_severity, species),
    }
    _cache[cache_key] = {**result, "_ts": now}
    return result


def _advice(level: str, species: str) -> list[str]:
    """Short, actionable expert advice keyed off the worst forecast level."""
    common_mild = [
        "Vérifier l'accès constant à l'eau fraîche",
        "Surveiller l'appétit et l'activité",
    ]
    common_moderate = [
        "Déplacer le troupeau vers une zone ombragée",
        "Alimentation en début de matinée et en soirée uniquement",
        "Douche/brumisation si disponible",
        "Éviter tout transport ou manipulation stressante",
    ]
    common_severe = [
        "🚨 Intervention vétérinaire préventive recommandée",
        "Ventilation active, ombrage total obligatoire",
        "Surveiller température rectale, arrêter toute production laitière intensive",
        "Isoler les animaux jeunes, gestantes ou malades en priorité",
    ]

    if level == "NORMAL":
        return ["Conditions normales — maintenir la surveillance habituelle."]
    if level == "MILD":
        return common_mild
    if level == "MODERATE":
        return common_mild + common_moderate
    return common_mild + common_moderate + common_severe
