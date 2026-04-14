import sys
import os
import json
from sqlalchemy.orm import Session

# Setup paths
sys.path.append(os.getcwd())

from app.db.session import SessionLocal
from app.models.all_models import Field


db = SessionLocal()
fields = db.query(Field).all()

print(f"Nombre de champs trouvés : {len(fields)}")
for f in fields:
    print(f"\nChamp ID: {f.id} - Nom: {f.name}")
    print(f"Polygon GeoJSON: {f.polygon_geojson}")
    # On teste si c'est du [lat, lng] ou [lng, lat]
    try:
        coords = json.loads(f.polygon_geojson)
        if coords:
            first = coords[0]
            # En Tunisie/Afrique du Nord, la latitude est autour de 35-37 et longitude autour de 9-11
            if 30 < first[0] < 40 and 5 < first[1] < 15:
                print("Format détecté : [Latitude, Longitude] (Style Leaflet/Standard)")
            elif 5 < first[0] < 15 and 30 < first[1] < 40:
                print("Format détecté : [Longitude, Latitude] (Style GeoJSON)")
            else:
                print(f"Format inconnu ou zone hors Tunisie : {first}")
    except Exception as e:
        print(f"Erreur de lecture : {e}")

db.close()
