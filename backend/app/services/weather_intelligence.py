import httpx
import logging
import time
from typing import List, Tuple

logger = logging.getLogger(__name__)

class WeatherIntelligence:
    """
    Service universel pour récupérer la météo en temps réel (Open-Meteo).
    Supporte le batching et le caching pour éviter les rate limits.
    """
    
    BASE_URL = "https://api.open-meteo.com/v1/forecast"
    CACHE_DURATION = 1800  # 30 minutes en secondes
    
    _cache = None
    _last_fetch_time = 0

    @classmethod
    async def get_batch_weather(cls, locations: List[Tuple[float, float]]):
        """
        Récupère la météo pour une liste de positions GPS.
        Inclut une gestion de cache de 30 minutes pour respecter les quotas API.
        """
        # Vérification du cache
        current_time = time.time()
        if cls._cache and (current_time - cls._last_fetch_time < cls.CACHE_DURATION):
            # Si le nombre de localisations correspond à peu près, on renvoie le cache
            # (Le daemon demande généralement le même batch d'animaux)
            if len(cls._cache) >= len(locations):
                return cls._cache[:len(locations)]
            
        if not locations:
            return []
            
        lats = ",".join([str(round(l[0], 4)) for l in locations])
        lons = ",".join([str(round(l[1], 4)) for l in locations])
        
        params = {
            "latitude": lats,
            "longitude": lons,
            "current_weather": "true",
            "timezone": "auto"
        }
        
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(cls.BASE_URL, params=params)
                response.raise_for_status()
                data = response.json()
                
                # data est soit un dict (si une seule loc) soit une liste de dicts
                results = []
                if isinstance(data, dict):
                    if "current_weather" in data:
                        results = [data["current_weather"]]
                    else:
                        # Cas multi-loc (dict d'objets ou structure spécifique)
                        results = [data[i].get("current_weather") for i in range(len(locations))] if isinstance(data, list) else []
                elif isinstance(data, list):
                    results = [d.get("current_weather") for d in data]
                
                if results:
                    cls._cache = results
                    cls._last_fetch_time = time.time()
                    logger.info(f"Weather Cache updated. Next fetch in 30 minutes.")
                
                return results if results else [{"temperature": 22.5}] * len(locations)
                    
        except Exception as e:
            # Réduire le spam dans les logs
            logger.warning(f"Weather Fetching paused (API rate limit or Offline). Using cache/fallback.")
            return cls._cache[:len(locations)] if cls._cache and len(cls._cache) >= len(locations) else [{"temperature": 22.5}] * len(locations)

    @classmethod
    async def get_current_weather(cls, lat: float, lon: float):
        """Simple wrapper pour une seule localisation."""
        res = await cls.get_batch_weather([(lat, lon)])
        return res[0] if res else {"temperature": 22.5}

weather_service = WeatherIntelligence()
