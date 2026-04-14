from app.db.session import SessionLocal
from app.models.all_models import (
    Animal, Farm, Cooperative, AnimalTelemetry, 
    VaccinationLog, TreatmentLog, ConsumptionLog
)
from datetime import datetime, timedelta
import random

def seed_complete_livestock():
    db = SessionLocal()
    try:
        # Resolve/Create Farm
        farm = db.query(Farm).first()
        if not farm:
            coop = Cooperative(name="Coopérative Sania")
            db.add(coop)
            db.flush()
            farm = Farm(name="Sania SVI Experimental Hub", cooperative_id=coop.id)
            db.add(farm)
            db.flush()
        
        # EFFACER LES TABLES DÉPENDANTES
        print("🧹 Nettoyage des journaux de santé...")
        db.query(AnimalTelemetry).delete()
        db.query(VaccinationLog).delete()
        db.query(TreatmentLog).delete()
        db.query(ConsumptionLog).delete()
        db.query(Animal).delete()
        db.commit()

        # Config: 5 animals per species
        species_config = {
            "Bovin": {"prefix": "BOV", "breed": "Charolaise", "weight": 650, "water": 45, "food": 15},
            "Ovin": {"prefix": "OVIN", "breed": "Ouessant", "weight": 70, "water": 6, "food": 2},
            "Caprin": {"prefix": "GOAT", "breed": "Alpine", "weight": 60, "water": 5, "food": 1.5},
            "Cheval": {"prefix": "CHV", "breed": "Pur-Sang", "weight": 520, "water": 35, "food": 10}
        }
        
        # New base coordinates (Westward shift -800m approx)
        base_lat, base_lng = 36.602, 10.484 # Updated to match user preference

        vets = ["Dr. Ahmed Sania", "Dr. Myriam Agri", "Clinique Alpha-Vet"]
        vaccines = ["Fièvre Aphteuse v4", "Brucellose B19", "Rage (Rappel)", "Variole Ovine"]

        for sp, cfg in species_config.items():
            for i in range(1, 6):
                tag = f"{cfg['prefix']}-{str(i).zfill(3)}"
                
                # Create Animal
                animal = Animal(
                    farm_id=farm.id,
                    tag_id=tag,
                    species=sp,
                    breed=cfg["breed"],
                    gender="Femelle" if i % 2 == 0 else "Mâle",
                    birth_date=datetime.now() - timedelta(days=random.randint(400, 1500)),
                    entry_date=datetime.now() - timedelta(days=180),
                    status="Sain" if i > 1 else "Critique",
                    weight_kg=cfg["weight"] + random.uniform(-10, 10),
                    latitude=36.60 + random.uniform(-0.005, 0.005),
                    longitude=10.46 + random.uniform(-0.005, 0.005)
                )
                db.add(animal)
                db.flush()

                # 1. TÉLÉMÉTRIE (20 derniers points)
                for j in range(20, 0, -1):
                    db.add(AnimalTelemetry(
                        animal_id=animal.id,
                        heart_rate=random.uniform(60, 85),
                        temperature_c=random.uniform(38.0, 39.0),
                        activity_level=random.choice(["GRAZING", "WALKING", "RESTING"]),
                        latitude=animal.latitude + random.uniform(-0.0001, 0.0001),
                        longitude=animal.longitude + random.uniform(-0.0001, 0.0001),
                        weight_kg=animal.weight_kg + random.uniform(-0.1, 0.1),
                        time=datetime.utcnow() - timedelta(minutes=j * 5)
                    ))

                # 2. CONSOMMATION (30 derniers jours) - SÉRIES TEMPORELLES
                for d in range(30, 0, -1):
                    # Drift métabolique réaliste (±5% par jour)
                    day_water = cfg['water'] * random.uniform(0.9, 1.1)
                    day_food = cfg['food'] * random.uniform(0.9, 1.1)
                    db.add(ConsumptionLog(
                        animal_id=animal.id,
                        water_liters=round(day_water, 2),
                        food_kg=round(day_food, 2),
                        date=datetime.now() - timedelta(days=d)
                    ))

                # 3. VACCINATIONS
                db.add(VaccinationLog(
                    animal_id=animal.id,
                    vaccine_name=random.choice(vaccines),
                    dose="2.5ml SC",
                    vet_name=random.choice(vets),
                    date=datetime.now() - timedelta(days=45),
                    next_due_date=datetime.now() + timedelta(days=180)
                ))

                # 4. TRAITEMENTS (Historique)
                if animal.status != "Sain":
                    db.add(TreatmentLog(
                        animal_id=animal.id,
                        diagnosis="Stress Thermique Détecté",
                        medicine="Réhydratant Vitaminé",
                        dosage="1 dose / JOUR",
                        vet_note="Observation SVI requise pendant 48h.",
                        date=datetime.now() - timedelta(days=2)
                    ))
                
                print(f"📡 [OK] {tag} : Bio-Données initialisées (30j métrique).")

        db.commit()
        print("\n🚀 SVI DATA CLUSTER READY : Historiques Santé & Métabolisme Invectés.")
    finally:
        db.close()

if __name__ == "__main__":
    seed_complete_livestock()
