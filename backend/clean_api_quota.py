import requests
from app.core.config import settings

def clean_agromonitoring_polygons():
    api_key = settings.AGROMONITORING_API_KEY
    poly_url = f"http://api.agromonitoring.com/agro/1.0/polygons?appid={api_key}"
    
    print("Récupération de vos polygones Agromonitoring...")
    res = requests.get(poly_url, timeout=15)
    
    if res.status_code != 200:
        print(f"Erreur API: {res.status_code} - {res.text}")
        return
        
    polygons = res.json()
    if not isinstance(polygons, list):
        print("Format inattendu reçu de l'API.")
        return
        
    print(f"[{len(polygons)}] polygones trouvés sur votre compte gratuit.")
    if len(polygons) == 0:
        print("Votre compte est déjà vide. Pas de nettoyage nécessaire.")
        return
        
    print("Nettoyage en cours (cela libérera votre quota gratuit)...")
    for p in polygons:
        pid = p.get("id")
        name = p.get("name", "Inconnu")
        del_res = requests.delete(f"http://api.agromonitoring.com/agro/1.0/polygons/{pid}?appid={api_key}")
        if del_res.status_code == 204:
            print(f"✅ Polygone {name} ({pid}) supprimé.")
        else:
            print(f"❌ Erreur sur {name}: {del_res.status_code}")
            
    print("\nNettoyage terminé ! Votre API satellite est réinitialisée.")
    print("Vous pouvez recharger la carte sur votre application, les champs vont se recréer automatiquement.")

if __name__ == "__main__":
    clean_agromonitoring_polygons()
