import httpx
import logging
import time
from typing import List, Tuple

logger = logging.getLogger(__name__)

class WeatherIntelligence:
    BASE_URL = "https://api.open-meteo.com/v1/forecast"
    CACHE_DURATION = 1800

    _cache = None
    _last_fetch_time = 0
    _thi_cache: dict = {}
    _THI_CACHE_TTL = 1800
    # Per-location last-known-good cache (no time limit — better than fake fallbacks)
    _location_cache: dict = {}

    @classmethod
    async def get_batch_weather(cls, locations: List[Tuple[float, float]]):
        current_time = time.time()
        if cls._cache and (current_time - cls._last_fetch_time < cls.CACHE_DURATION):
            if len(cls._cache) >= len(locations):
                return cls._cache[:len(locations)]
        if not locations:
            return []
        lats = ",".join([str(round(l[0], 4)) for l in locations])
        lons = ",".join([str(round(l[1], 4)) for l in locations])
        params = {"latitude": lats, "longitude": lons, "current_weather": "true", "timezone": "auto"}
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(cls.BASE_URL, params=params)
                response.raise_for_status()
                data = response.json()
            results = []
            if isinstance(data, dict):
                if "current_weather" in data:
                    results = [data["current_weather"]]
            elif isinstance(data, list):
                results = [d.get("current_weather") for d in data]
            if results:
                cls._cache = results
                cls._last_fetch_time = time.time()
                # Persist per-location last-known-good readings
                for (lat, lon), reading in zip(locations, results):
                    if reading and reading.get("temperature") is not None:
                        cls._location_cache[f"{round(lat,3)}_{round(lon,3)}"] = {
                            "data": reading,
                            "ts": current_time,
                        }
            if results:
                return results
        except Exception as exc:
            logger.warning(f"Weather batch fetch failed: {exc}")

        # Real fallback: per-location last-known-good readings, marked as stale.
        out = []
        for lat, lon in locations:
            key = f"{round(lat,3)}_{round(lon,3)}"
            entry = cls._location_cache.get(key)
            if entry:
                stale = {**entry["data"], "stale": True, "stale_age_s": int(current_time - entry["ts"])}
                out.append(stale)
            elif cls._cache:
                out.append({**cls._cache[0], "stale": True})
            else:
                # No real data ever observed → return None so callers can react
                out.append({"temperature": None, "stale": True, "no_data": True})
        return out

    @classmethod
    async def get_current_weather(cls, lat: float, lon: float):
        res = await cls.get_batch_weather([(lat, lon)])
        return res[0] if res else {"temperature": None, "stale": True, "no_data": True}

    @classmethod
    async def get_thi_forecast(cls, lat: float, lon: float) -> dict:
        cache_key = f"{lat:.3f}_{lon:.3f}"
        now = time.time()
        if cache_key in cls._thi_cache:
            entry = cls._thi_cache[cache_key]
            if now - entry["ts"] < cls._THI_CACHE_TTL:
                return entry["data"]
        params = {
            "latitude":  round(lat, 4), "longitude": round(lon, 4),
            "current":   "temperature_2m,relative_humidity_2m",
            "hourly":    "temperature_2m,relative_humidity_2m",
            "forecast_days": 2, "timezone": "auto",
        }
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(cls.BASE_URL, params=params)
                resp.raise_for_status()
                raw = resp.json()
            current  = raw.get("current", {})
            temp_now = current.get("temperature_2m")
            rh_now   = current.get("relative_humidity_2m")
            if temp_now is None or rh_now is None:
                raise ValueError("Open-Meteo returned null current values")
            hourly = raw.get("hourly", {})
            times  = hourly.get("time", [])
            temps  = hourly.get("temperature_2m", [])
            rhs    = hourly.get("relative_humidity_2m", [])
            from datetime import datetime, timezone
            now_dt = datetime.now(timezone.utc)
            forecast = []
            for t, temp, rh in zip(times, temps, rhs):
                try:
                    dt = datetime.fromisoformat(t)
                    if dt.tzinfo is None:
                        dt = dt.replace(tzinfo=timezone.utc)
                    if dt >= now_dt and len(forecast) < 24:
                        forecast.append({"time": dt.strftime("%H:%M"), "temp": round(temp,1),
                                         "rh": round(rh,1), "thi": round(_thi(temp, rh), 1)})
                except Exception:
                    continue
            data = {"temp_now": round(temp_now,1), "rh_now": round(rh_now,1),
                    "thi_now": round(_thi(temp_now, rh_now), 1), "forecast": forecast}
            cls._thi_cache[cache_key] = {"data": data, "ts": now}
            return data
        except Exception as exc:
            logger.warning(f"THI forecast fetch failed: {exc}")
            # Real fallback: return last successful entry for this location if any
            if cache_key in cls._thi_cache:
                stale = cls._thi_cache[cache_key]["data"]
                return {**stale, "stale": True}
            return {"temp_now": None, "rh_now": None, "thi_now": None,
                    "forecast": [], "stale": True, "no_data": True}


def _thi(temp_c: float, rh_pct: float) -> float:
    return temp_c - (0.31 - 0.31 * rh_pct / 100.0) * (temp_c - 14.4)


weather_service = WeatherIntelligence()
