import os
import requests
from app.core.config import settings
from app.db.session import SessionLocal
from app.models.all_models import Field
import json

def test_fields():
    db = SessionLocal()
    fields = db.query(Field).all()
    api_key = settings.AGROMONITORING_API_KEY
    poly_url = f"http://api.agromonitoring.com/agro/1.0/polygons?appid={api_key}"

    print(f"Testing {len(fields)} fields against Agromonitoring API...")
    for field in fields:
        print(f"\n--- Field: {field.name} ({field.id}) ---")
        try:
            coords = json.loads(field.polygon_geojson)
            if not coords or len(coords) < 3:
                print("Skipped: No valid coords")
                continue
            geo_coords = [[c[1], c[0]] for c in coords]
            if geo_coords[0] != geo_coords[-1]:
                geo_coords.append(geo_coords[0])

            payload = {
                "name": f"SANIA_{field.id}",
                "geo_json": {
                    "type": "Feature",
                    "properties": {},
                    "geometry": {"type": "Polygon", "coordinates": [geo_coords]},
                },
            }
            res = requests.post(poly_url, json=payload, timeout=15)
            print(f"Status: {res.status_code}")
            print(f"Body: {res.text}")
        except Exception as e:
            print(f"Error checking field: {e}")

if __name__ == '__main__':
    test_fields()
