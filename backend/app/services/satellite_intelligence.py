import os
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

_NDVI_EVALSCRIPT = """//VERSION=3
function setup() {
  return {
    input: [{bands: ["B04", "B08", "dataMask"]}],
    output: [
      {id: "ndvi",     bands: 1, sampleType: "FLOAT32"},
      {id: "dataMask", bands: 1}
    ]
  };
}
function evaluatePixel(s) {
  return {
    ndvi:     [index(s.B08, s.B04)],
    dataMask: [s.dataMask]
  };
}"""


class SatelliteIntelligence:
    _TOKEN_URL = "https://services.sentinel-hub.com/oauth/token"
    _STATS_URL = "https://services.sentinel-hub.com/api/v1/statistics"

    def __init__(self):
        self._token: Optional[str] = None
        self._token_expires: Optional[datetime] = None
        self._cache: dict[str, dict] = {}
        self._client_id     = os.getenv("SENTINEL_HUB_CLIENT_ID", "").strip()
        self._client_secret = os.getenv("SENTINEL_HUB_CLIENT_SECRET", "").strip()
        self._enabled = bool(self._client_id and self._client_secret)
        if self._enabled:
            logger.info("SatelliteIntelligence: Sentinel Hub activé (données réelles).")
        else:
            logger.info("SatelliteIntelligence: mode déterministe (pas de credentials).")

    def _refresh_token(self) -> Optional[str]:
        now = datetime.now(timezone.utc)
        if self._token and self._token_expires and now < self._token_expires:
            return self._token
        try:
            with httpx.Client(timeout=10.0) as client:
                resp = client.post(
                    self._TOKEN_URL,
                    data={
                        "grant_type":    "client_credentials",
                        "client_id":     self._client_id,
                        "client_secret": self._client_secret,
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                self._token = data["access_token"]
                expires_in = int(data.get("expires_in", 3600))
                self._token_expires = now + timedelta(seconds=expires_in - 30)
                return self._token
        except Exception as exc:
            logger.warning(f"Sentinel Hub token error: {exc}")
            return None

    def _fetch_ndvi_from_sentinel(self, lat: float, lon: float) -> Optional[float]:
        token = self._refresh_token()
        if not token:
            return None
        delta = 0.01
        bbox = [
            round(lon - delta, 6), round(lat - delta, 6),
            round(lon + delta, 6), round(lat + delta, 6),
        ]
        now       = datetime.now(timezone.utc)
        date_to   = now.strftime("%Y-%m-%dT%H:%M:%SZ")
        date_from = (now - timedelta(days=90)).strftime("%Y-%m-%dT%H:%M:%SZ")
        payload = {
            "input": {
                "bounds": {
                    "bbox": bbox,
                    "properties": {"crs": "http://www.opengis.net/def/crs/EPSG/0/4326"},
                },
                "data": [{"type": "sentinel-2-l2a", "dataFilter": {"maxCloudCoverage": 90}}],
            },
            "aggregation": {
                "timeRange": {"from": date_from, "to": date_to},
                "aggregationInterval": {"of": "P1D"},
                "evalscript": _NDVI_EVALSCRIPT,
                "width":  128,
                "height": 128,
            },
            "calculations": {"ndvi": {}},
        }
        try:
            with httpx.Client(timeout=25.0) as client:
                resp = client.post(
                    self._STATS_URL, json=payload,
                    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                )
                resp.raise_for_status()
                data = resp.json()
            valid_means: list[float] = []
            for interval in reversed(data.get("data", [])):
                stats = (interval.get("outputs", {}).get("ndvi", {})
                         .get("bands", {}).get("B0", {}).get("stats", {}))
                mean_val     = stats.get("mean")
                no_data      = stats.get("noDataCount", 1)
                sample_count = stats.get("sampleCount", 1)
                valid_ratio  = 1.0 - no_data / max(sample_count, 1)
                if mean_val is not None and valid_ratio >= 0.2:
                    valid_means.append(float(mean_val))
                    if len(valid_means) >= 3:
                        break
            if valid_means:
                avg = sum(valid_means) / len(valid_means)
                return round(max(-1.0, min(1.0, avg)), 4)
            logger.warning(f"Sentinel Hub: aucune donnée valide pour ({lat:.4f}, {lon:.4f}).")
            return None
        except httpx.HTTPStatusError as exc:
            logger.warning(f"Sentinel Hub stats HTTP {exc.response.status_code}: {exc.response.text[:250]}")
            return None
        except Exception as exc:
            logger.warning(f"Sentinel Hub stats error: {exc}")
            return None

    def _fetch_nasa_power_proxy(self, lat: float, lon: float) -> Optional[float]:
        """
        Real-data NDVI proxy via NASA POWER (free, no key, official agency data).
        Derives a vegetation health index from PAR, root-zone soil moisture, and
        14-day precipitation accumulation — the same inputs USDA's VegDRI uses
        when MODIS is unavailable.
        """
        try:
            now = datetime.now(timezone.utc)
            end = now.strftime("%Y%m%d")
            start = (now - timedelta(days=14)).strftime("%Y%m%d")
            url = "https://power.larc.nasa.gov/api/temporal/daily/point"
            params = {
                "parameters": "ALLSKY_SFC_PAR_TOT,GWETROOT,PRECTOTCORR,T2M",
                "community":  "AG",
                "longitude":  round(lon, 4),
                "latitude":   round(lat, 4),
                "start":      start,
                "end":        end,
                "format":     "JSON",
            }
            with httpx.Client(timeout=15.0) as client:
                resp = client.get(url, params=params)
                resp.raise_for_status()
                data = resp.json()

            params_data = data.get("properties", {}).get("parameter", {})
            par   = [float(x) for x in params_data.get("ALLSKY_SFC_PAR_TOT", {}).values() if x is not None and x > -900]
            gwet  = [float(x) for x in params_data.get("GWETROOT",          {}).values() if x is not None and x > -900]
            prec  = [float(x) for x in params_data.get("PRECTOTCORR",       {}).values() if x is not None and x > -900]
            t2m   = [float(x) for x in params_data.get("T2M",               {}).values() if x is not None and x > -900]

            if not (par and gwet and t2m):
                return None

            avg_par   = sum(par)  / len(par)
            avg_gwet  = sum(gwet) / len(gwet)
            sum_prec  = sum(prec)
            avg_t2m   = sum(t2m)  / len(t2m)

            par_score    = max(0.0, min(1.0, avg_par / 25.0))
            water_score  = max(0.0, min(1.0, avg_gwet))
            prec_score   = max(0.0, min(1.0, sum_prec / 80.0))
            temp_penalty = 0.0 if 8 <= avg_t2m <= 32 else min(0.4, abs(avg_t2m - 20) / 30.0)

            ndvi_proxy = (0.35 * water_score + 0.25 * prec_score
                          + 0.30 * par_score - temp_penalty)
            return round(max(0.05, min(0.92, 0.10 + 0.85 * ndvi_proxy)), 4)
        except Exception as exc:
            logger.warning(f"NASA POWER proxy failed: {exc}")
            return None

    def _cache_key(self, lat: float, lon: float) -> str:
        now    = datetime.now()
        window = now.hour // 6
        return f"{lat:.3f}_{lon:.3f}_{now.strftime('%Y%m%d')}_{window}"

    def get_ndvi_for_location(self, lat: float, lon: float) -> dict:
        key = self._cache_key(lat, lon)
        if key in self._cache:
            return {**self._cache[key], "cached": True}
        ndvi_value: Optional[float] = None
        provider = "—"
        if self._enabled:
            ndvi_value = self._fetch_ndvi_from_sentinel(lat, lon)
            if ndvi_value is not None:
                provider = "Sentinel-2 L2A (Copernicus ESA)"
        if ndvi_value is None:
            ndvi_value = self._fetch_nasa_power_proxy(lat, lon)
            if ndvi_value is not None:
                provider = "NASA POWER (vegetation proxy)"
        if ndvi_value is None:
            # All real sources unreachable: return last cached entry for this
            # coarse cell if we have one, else surface failure honestly.
            for k, v in self._cache.items():
                if k.startswith(f"{lat:.3f}_{lon:.3f}"):
                    return {**v, "cached": True, "stale": True}
            return {
                "ndvi_value": None, "status": "Unavailable",
                "captured_at": datetime.now().isoformat(),
                "provider": "No real source available",
                "coordinates": {"lat": round(lat, 6), "lon": round(lon, 6)},
                "cached": False,
            }
        status = ("Healthy" if ndvi_value > 0.6 else ("Stressed" if ndvi_value > 0.3 else "Poor"))
        result = {
            "ndvi_value":  ndvi_value, "status": status,
            "captured_at": datetime.now().isoformat(), "provider": provider,
            "coordinates": {"lat": round(lat, 6), "lon": round(lon, 6)},
            "cached":      False,
        }
        self._cache[key] = result
        return result


satellite_service = SatelliteIntelligence()
