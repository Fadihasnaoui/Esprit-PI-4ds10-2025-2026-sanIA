import json
import requests
from datetime import datetime, timedelta
from app.core.config import settings
from app.models.all_models import NDVIRecord
from sqlalchemy.orm import Session
from uuid import UUID

class NDVIDiagnosticService:
    @staticmethod
    def get_color_for_ndvi(ndvi: float) -> str:
        if ndvi < 0.2: return "#d73027"
        elif ndvi < 0.4: return "#fdae61"
        elif ndvi < 0.6: return "#a6d96a"
        else: return "#1a9850"

    @staticmethod
    def get_health_label(ndvi: float) -> str:
        if ndvi < 0.2: return "Sol nu / Stress critique"
        elif ndvi < 0.4: return "Végétalisation faible / Stress hydrique"
        elif ndvi < 0.6: return "Vigueur moyenne / Croissance normale"
        else: return "Vigueur excellente / Biomasse élevée"

    @staticmethod
    def get_real_diagnostic(db: Session, field_id: UUID, polygon_geojson: str):
        api_key = settings.AGROMONITORING_API_KEY
        if not api_key or "votre_cle" in api_key:
            return {"summary": {"error": "Clé API non configurée"}, "zones": []}

        try:
            coords = json.loads(polygon_geojson)
            if not coords or len(coords) < 3: return None
        except:
            return None

        # 1. Coordonnées GeoJSON
        geo_coords = [[c[1], c[0]] for c in coords]
        if geo_coords[0] != geo_coords[-1]: geo_coords.append(geo_coords[0])

        polygon_payload = {
            "name": f"Field_{field_id}",
            "geo_json": {
                "type": "Feature",
                "properties": {},
                "geometry": {"type": "Polygon", "coordinates": [geo_coords]}
            }
        }

        # 2. Gestion du Polygone Agromonitoring
        poly_url = f"http://api.agromonitoring.com/agro/1.0/polygons?appid={api_key}"
        poly_id = None
        try:
            poly_res = requests.post(poly_url, json=polygon_payload, timeout=10)
            poly_data = poly_res.json()
            poly_id = poly_data.get("id")
            
            # Gérer le cas du polygone dupliqué "422"
            if not poly_id and poly_res.status_code == 422 and "already existed polygon" in poly_res.text:
                import re
                match = re.search(r"'(.*?)'", poly_data.get("message", ""))
                if match:
                    poly_id = match.group(1)

            # Recherche par nom si toujours rien
            if not poly_id:
                list_res = requests.get(poly_url, timeout=10).json()
                for p in list_res:
                    if str(field_id) in str(p.get("name")):
                        poly_id = p.get("id")
                        break
                        
            if not poly_id: 
                return {
                    "summary": {
                        "date": datetime.now().strftime('%d/%m/%Y'),
                        "clouds": 0,
                        "source": "Erreur API",
                        "health_label": "Format/Taille Invalide",
                        "min_ndvi": "N/A", "max_ndvi": "N/A"
                    },
                    "zones": [{"polygon": coords, "ndvi": "N/A", "color": "#787878"}]
                }
        except Exception as e:
            return {"summary": {"error": "Connexion API échouée", "health_label": "Erreur Réseau"}, "zones": [{"polygon": coords, "ndvi": "N/A", "color": "#787878"}]}

        # 3. Recherche de la meilleure image (Anti-nuages)
        end_date = int(datetime.now().timestamp())
        start_date = int((datetime.now() - timedelta(days=1500)).timestamp()) # Remonter à 1500j pour assurer la data réelle
        search_url = f"http://api.agromonitoring.com/agro/1.0/image/search?start={start_date}&end={end_date}&polyid={poly_id}&appid={api_key}"
        images = requests.get(search_url, timeout=10).json()

        if not isinstance(images, list) or len(images) == 0:
            return {
                "summary": {
                    "date": datetime.now().strftime('%d/%m/%Y'),
                    "clouds": 0,
                    "source": "Sentinel-2 (Réel)",
                    "health_label": "Non Agricole (Zone Urbaine / Trop Petite)",
                    "min_ndvi": "N/A", "max_ndvi": "N/A"
                },
                "zones": [{"polygon": coords, "ndvi": "N/A", "color": "rgba(100, 100, 100, 0.4)"}]
            }

        # On prend l'image avec le minimum de nuages
        best_img = sorted(images, key=lambda x: x.get("cl", 100))[0]
        
        # 4. Récupération des statistiques réelles (NDVI + EVI)
        stats_ndvi_url = best_img.get("stats", {}).get("ndvi")
        stats_evi_url = best_img.get("stats", {}).get("evi")
        image_date = datetime.fromtimestamp(best_img["dt"])

        summary_data = {
            "date": image_date.strftime('%d/%m/%Y'),
            "clouds": round(best_img.get("cl", 0), 1),
            "source": "Sentinel-2 L2A",
            "health_label": "Inconnu"
        }

        if stats_ndvi_url:
            stats_raw = requests.get(stats_ndvi_url).json()
            mean_ndvi = stats_raw.get("mean", 0)
            summary_data.update({
                "avg_ndvi": round(mean_ndvi, 2),
                "min_ndvi": round(stats_raw.get("min", 0), 2),
                "max_ndvi": round(stats_raw.get("max", 0), 2),
                "health_label": NDVIDiagnosticService.get_health_label(mean_ndvi)
            })
            
            # Sync DB
            if not db.query(NDVIRecord).filter(NDVIRecord.field_id == field_id, NDVIRecord.captured_at == image_date).first():
                db.add(NDVIRecord(field_id=field_id, ndvi_value=round(mean_ndvi, 2), status="SAT_AUTO", captured_at=image_date))
                db.commit()

        if stats_evi_url:
            evi_raw = requests.get(stats_evi_url).json()
            summary_data["avg_evi"] = round(evi_raw.get("mean", 0), 2)

        return {
            "summary": summary_data,
            "zones": [{
                "polygon": coords,
                "ndvi": summary_data.get("avg_ndvi", 0),
                "color": NDVIDiagnosticService.get_color_for_ndvi(summary_data.get("avg_ndvi", 0))
            }]
        }

ndvi_diagnostic_service = NDVIDiagnosticService()
