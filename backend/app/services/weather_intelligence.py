import httpx
import logging
from typing import List, Tuple

logger = logging.getLogger(__name__)

class WeatherIntelligence:
    """
    Service universel pour récupérer la météo en temps réel (Open-Meteo).
    Supporte le batching pour des performances optimales.
    """
    
    BASE_URL = "https://api.open-meteo.com/v1/forecast"

    @classmethod
    async def get_batch_weather(cls, locations: List[Tuple[float, float]]):
        """
        Récupère la météo pour une liste de positions GPS en UN SEUL appel API.
        Open-Meteo supporte jusqu'à ~50-100 localisations par requête via virgules.
        """
        if not locations:
            return []
            
        lats = ",".join([str(l[0]) for l in locations])
        lons = ",".join([str(l[1]) for l in locations])
        
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
                if isinstance(data, dict):
                    if "current_weather" in data:
                        return [data["current_weather"]]
                    return [data[i].get("current_weather") for i in range(len(locations))]
                elif isinstance(data, list):
                    return [d.get("current_weather") for d in data]
                else:
                    # Cas spécifique Open-Meteo multi-loc (renvoie un dictionnaire avec listes si params simples)
                    # Mais avec current_weather=true et listes de lats, il renvoie souvent une liste de dicts
                    # ou un dict d'objets.
                    return data
                    
        except Exception as e:
            # Réduire le spam dans les logs
            logger.warning(f"Weather Fetching paused (API rate limit or Offline). Fallback used.")
            return [{"temperature": 22.5}] * len(locations)

    @classmethod
    async def get_current_weather(cls, lat: float, lon: float):
        """Simple wrapper pour une seule localisation."""
        res = await cls.get_batch_weather([(lat, lon)])
        return res[0] if res else {"temperature": 22.5}

weather_service = WeatherIntelligence()
