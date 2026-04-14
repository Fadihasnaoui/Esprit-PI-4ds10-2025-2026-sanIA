import json
import re

def parse_coordinates(location_str):
    """
    Tente d'extraire lat/lon d'une chaîne "lat, lon" ou renvoie None.
    Ex: "36.60, 10.49" -> (36.60, 10.49)
    """
    if not location_str:
        return None
    
    try:
        # Regex pour matcher deux flottants séparés par une virgule ou espace
        match = re.findall(r"[-+]?\d*\.\d+|\d+", location_str)
        if len(match) >= 2:
            return float(match[0]), float(match[1])
    except Exception:
        pass
    return None

def get_field_centroid(polygon_geojson_str):
    """
    Calcule le centroïde simple d'un GeoJSON Polygon.
    """
    if not polygon_geojson_str:
        return None
        
    try:
        geo = json.loads(polygon_geojson_str)
        coords = geo.get("coordinates", [[]])[0]
        if not coords:
            return None
            
        lats = [c[1] for c in coords]
        lons = [c[0] for c in coords]
        
        return sum(lats) / len(lats), sum(lons) / len(lons)
    except Exception:
        return None
