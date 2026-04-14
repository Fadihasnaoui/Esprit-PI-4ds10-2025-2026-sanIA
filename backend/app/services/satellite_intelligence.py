import math
from datetime import datetime

class SatelliteIntelligence:
    """
    Simule une intelligence satellitaire universelle (NDVI).
    En l'absence de clé Sentinel-Hub, utilise un modèle déterministe basé sur :
    1. Les coordonnées (Zonage climatique)
    2. La date (Cycle saisonnier)
    3. Le relief local (approximé)
    C'est plus "réel" qu'un random pur car cohérent géographiquement.
    """
    
    @classmethod
    def get_ndvi_for_location(cls, lat: float, lon: float):
        """
        Calcule un NDVI théorique réaliste pour n'importe quel point du globe.
        """
        day_of_year = datetime.now().timetuple().tm_yday
        
        # 1. Influence de la latitude (Saisonalité inversée Nord/Sud)
        # Pic de végétation en été local
        is_northern = lat > 0
        peak_day = 172 if is_northern else 355 # Juin vs Décembre
        
        # Oscillation saisonnière (sinusoïde)
        seasonal_factor = 0.5 + 0.3 * math.cos(2 * math.pi * (day_of_year - peak_day) / 365)
        
        # 2. Influence régionale (Climat aride vs Tropical vs Tempéré)
        # Très simplifié : Proximité équateur = NDVI plus élevé permanent
        lat_abs = abs(lat)
        if lat_abs < 10: # Tropical
            base_ndvi = 0.75
            seasonal_amp = 0.1
        elif lat_abs < 30: # Aride/Subtropical
            base_ndvi = 0.3
            seasonal_amp = 0.2
        else: # Tempéré
            base_ndvi = 0.45
            seasonal_amp = 0.35
            
        ndvi = base_ndvi + (seasonal_amp * math.cos(2 * math.pi * (day_of_year - peak_day) / 365))
        
        # 3. Ajout d'une variation locale basée sur les décimales des coordonnées
        # Pour que deux champs voisins n'aient pas exactement la même valeur
        local_var = (math.sin(lat * 1000) + math.cos(lon * 1000)) * 0.05
        
        final_ndvi = max(0.05, min(0.95, ndvi + local_var))
        
        status = "Healthy" if final_ndvi > 0.6 else ("Stressed" if final_ndvi > 0.3 else "Poor")
        
        return {
            "ndvi_value": round(final_ndvi, 4),
            "status": status,
            "captured_at": datetime.now().isoformat(),
            "provider": "Sania-SVI-Orbital (Derived)"
        }

satellite_service = SatelliteIntelligence()
