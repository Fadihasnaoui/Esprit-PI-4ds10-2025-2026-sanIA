
import requests
import os
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("AGROMONITORING_API_KEY")

def clear_all_polygons():
    if not API_KEY:
        print("Erreur: Clé API non trouvée dans .env")
        return

    print(f"Connexion à Agromonitoring avec la clé: {API_KEY[:6]}...")
    
    # 1. Lister tous les polygones
    url = f"http://api.agromonitoring.com/agro/1.0/polygons?appid={API_KEY}"
    res = requests.get(url)
    
    if res.status_code != 200:
        print(f"Erreur lors de la lecture: {res.text}")
        return

    polygons = res.json()
    if not polygons:
        print("Aucun polygone trouvé. Votre quota devrait être libre.")
        return

    print(f"Trouvé {len(polygons)} polygones. Suppression en cours...")

    # 2. Supprimer chaque polygone
    for p in polygons:
        pid = p['id']
        name = p.get('name', 'Sans nom')
        del_url = f"http://api.agromonitoring.com/agro/1.0/polygons/{pid}?appid={API_KEY}"
        del_res = requests.delete(del_url)
        if del_res.status_code in (200, 204):
            print(f" OK: Supprimé '{name}' ({pid})")
        else:
            print(f" Erreur sur {pid}: {del_res.text}")

    print("\nNettoyage terminé ! Vous pouvez maintenant recréer des champs.")

if __name__ == "__main__":
    clear_all_polygons()
