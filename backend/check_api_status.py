import os
from pathlib import Path

import requests
from dotenv import load_dotenv

_BACKEND = Path(__file__).resolve().parent
load_dotenv(_BACKEND / ".env", override=True)
API_KEY = os.getenv("AGROMONITORING_API_KEY")

def check():
    if not API_KEY:
        print("Erreur: Pas de clé API")
        return

    url = f"https://api.agromonitoring.com/agro/1.0/polygons?appid={API_KEY}"
    res = requests.get(url)
    print(f"Status Coordonnées: {res.status_code}")
    if res.status_code == 200:
        polygons = res.json()
        print(f"Polygones actifs sur le compte: {len(polygons)}")
        for p in polygons:
            print(f"- {p.get('name')} (ID: {p['id']})")
    else:
        print(f"Erreur API: {res.text}")

    # Check if a simple creation works
    print("\nTest de création temporaire...")
    test_payload = {
        "name": "TEST_CONNECTIVITY",
        "geo_json": {
            "type": "Feature",
            "properties": {},
            "geometry": {"type": "Polygon", "coordinates": [[[10, 36], [10.01, 36], [10.01, 36.01], [10, 36.01], [10, 36]]]}
        }
    }
    post_res = requests.post(url, json=test_payload)
    print(f"Status Création: {post_res.status_code}")
    print(f"Réponse: {post_res.text}")

if __name__ == "__main__":
    check()
