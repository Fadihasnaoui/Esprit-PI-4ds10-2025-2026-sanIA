"""
List / delete Agromonitoring polygons for the API key in backend/.env.

If the list is empty but Sania still shows « quota », run the diagnostic at the end:
413 on POST with 0 polygons = subscription / monthly API limit, not « delete old polygons ».
"""
import sys
from pathlib import Path

import requests

# Allow:  cd backend && python clean_api_quota.py
_BACKEND = Path(__file__).resolve().parent
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

from app.core.config import settings  # noqa: E402

POLY_BASE = "https://api.agromonitoring.com/agro/1.0/polygons"

# Minimal valid test polygon (Tunisia-sized box — same idea as check_api_status)
TEST_PAYLOAD = {
    "name": "SANIA_QUOTA_TEST_DELETE_ME",
    "geo_json": {
        "type": "Feature",
        "properties": {},
        "geometry": {
            "type": "Polygon",
            "coordinates": [[[10, 36], [10.01, 36], [10.01, 36.01], [10, 36.01], [10, 36]]],
        },
    },
}


def _mask_key(key: str | None) -> str:
    if not key:
        return "(aucune clé)"
    k = key.strip()
    if len(k) <= 8:
        return k[:2] + "…"
    return f"{k[:4]}…{k[-4:]}"


def clean_agromonitoring_polygons():
    api_key = (settings.AGROMONITORING_API_KEY or "").strip()
    print(f"Clé API (extrait): {_mask_key(api_key)}")
    if not api_key:
        print("Erreur: AGROMONITORING_API_KEY absente dans backend/.env")
        return

    poly_url = f"{POLY_BASE}?appid={api_key}"

    print("Récupération de vos polygones Agromonitoring...")
    res = requests.get(poly_url, timeout=15)

    if res.status_code != 200:
        print(f"Erreur API: {res.status_code} - {res.text[:500]}")
        return

    polygons = res.json()
    if not isinstance(polygons, list):
        print("Format inattendu reçu de l'API.")
        return

    print(f"[{len(polygons)}] polygone(s) sur ce compte (clé API).")

    if len(polygons) == 0:
        print("\n--- Diagnostic création (pourquoi Sania affiche encore « quota » ?) ---")
        print("Avec 0 polygone, un refus 413 signifie souvent limite d’abonnement / quota mensuel,")
        print("pas « trop de polygones à supprimer ».\n")
        test = requests.post(poly_url, json=TEST_PAYLOAD, timeout=20)
        print(f"POST polygone test -> HTTP {test.status_code}")
        body = None
        try:
            body = test.json()
            print(f"Réponse JSON: {body}")
        except Exception:
            print(f"Corps brut: {test.text[:500]}")

        jid = body.get("id") if isinstance(body, dict) else None
        if test.status_code in (200, 201) and jid:
            d = requests.delete(f"{POLY_BASE}/{jid}?appid={api_key}", timeout=15)
            print(f"Polygone test supprime -> HTTP {d.status_code}")
        print(
            "\nSi vous voyez 413 : consultez l’offre / facturation sur agromonitoring.com, "
            "ou utilisez AGROMONITORING_SIMULATE_ON_QUOTA=true dans backend/.env (démo uniquement)."
        )
        return

    print("Nettoyage en cours (cela libérera des emplacements sur le compte)...")
    for p in polygons:
        pid = p.get("id")
        name = p.get("name", "Inconnu")
        del_res = requests.delete(f"{POLY_BASE}/{pid}?appid={api_key}", timeout=15)
        if del_res.status_code == 204:
            print(f"✅ Polygone {name} ({pid}) supprimé.")
        else:
            print(f"❌ Erreur sur {name}: {del_res.status_code}")

    print("\nNettoyage terminé. Rechargez l’analyse satellite dans Sania.")


if __name__ == "__main__":
    clean_agromonitoring_polygons()
