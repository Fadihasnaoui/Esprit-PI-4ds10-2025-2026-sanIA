"""
🌿 SANIA — Database Seed Script
Populates the database with realistic Tunisian agriculture demo data.
Run: python seed_data.py
"""
import sys, os, random, uuid
from datetime import datetime, timedelta
# Make sure we can import the app modules
sys.path.insert(0, os.path.dirname(__file__))

from app.db.session import SessionLocal, engine, Base
from app.models.all_models import (
    Cooperative, User, UserRole, Farm, Field,
    SensorReading, IrrigationLog, DiseaseScan, NDVIRecord,
    Animal, VaccinationLog, TreatmentLog, Alert,
)
from app.core.security import get_password_hash

# ─── Fixed UUIDs for consistency ───
Base.metadata.create_all(bind=engine)
COOP_ID     = uuid.UUID("11111111-1111-1111-1111-111111111111")
FARM_ID     = uuid.UUID("88888888-4444-4444-4444-121212121212")
FARMER_ID   = uuid.UUID("22222222-2222-2222-2222-222222222222")
FIELD_IDS   = [
    uuid.UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
    uuid.UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
    uuid.UUID("cccccccc-cccc-cccc-cccc-cccccccccccc"),
    uuid.UUID("dddddddd-dddd-dddd-dddd-dddddddddddd"),
]
ANIMAL_IDS = [uuid.uuid4() for _ in range(8)]

def seed():
    db = SessionLocal()
    now = datetime.utcnow()

    try:
        # ════════════════════════════════════════
        # 0. CLEAN OLD DATA (reverse FK order)
        # ════════════════════════════════════════
        print("🗑️  Nettoyage des anciennes données...")
        db.query(VaccinationLog).delete()
        db.query(TreatmentLog).delete()
        db.query(Alert).delete()
        db.query(DiseaseScan).delete()
        db.query(NDVIRecord).delete()
        db.query(IrrigationLog).delete()
        db.query(SensorReading).delete()
        db.query(Animal).delete()
        db.query(Field).delete()
        db.query(Farm).delete()
        db.query(User).delete()
        db.query(Cooperative).delete()
        db.commit()

        # ════════════════════════════════════════
        # 1. COOPERATIVE
        # ════════════════════════════════════════
        print("🏛️  Création de la coopérative...")
        coop = Cooperative(id=COOP_ID, name="Coopérative Agricole du Cap Bon", location="Nabeul, Tunisie")
        db.add(coop)

        # ════════════════════════════════════════
        # 2. USER (farmer)
        # ════════════════════════════════════════
        print("👤 Création de l'utilisateur...")
        user = User(
            id=FARMER_ID, name="Ahmed Ben Salem", email="farmer@agrismart.tn",
            password_hash=get_password_hash("Farmer123!"),
            role=UserRole.FARMER, cooperative_id=COOP_ID, farm_id=FARM_ID,
        )
        db.add(user)

        # ════════════════════════════════════════
        # 3. FARM
        # ════════════════════════════════════════
        print("🌾 Création de la ferme...")
        farm = Farm(
            id=FARM_ID, cooperative_id=COOP_ID,
            name="Domaine Ben Salem", location="Grombalia, Cap Bon", owner_name="Ahmed Ben Salem",
        )
        db.add(farm)
        db.commit()

        # ════════════════════════════════════════
        # 4. FIELDS (4 parcelles)
        # ════════════════════════════════════════
        print("🏕️  Création des parcelles...")
        fields_data = [
            {"id": FIELD_IDS[0], "name": "Champ de Pomme de Terre Bizerte", "crop_type": "Potato",  "area_ha": 12.5},
            {"id": FIELD_IDS[1], "name": "Vignoble du Cap Bon",        "crop_type": "Grape",   "area_ha": 8.3},
            {"id": FIELD_IDS[2], "name": "Champ de Tomates Nabeul",    "crop_type": "Tomato",  "area_ha": 4.7},
            {"id": FIELD_IDS[3], "name": "Verger de Pommiers Kasserine","crop_type": "Apple",   "area_ha": 15.0},
        ]
        for fd in fields_data:
            db.add(Field(farm_id=FARM_ID, polygon_geojson="[]", **fd))
        db.commit()

        # ════════════════════════════════════════
        # 5. SENSOR READINGS — 7 days, 4 per day per field
        # ════════════════════════════════════════
        print("📡 Génération des lectures capteurs (7 jours × 4/jour × 4 champs = 112 lectures)...")
        base_profiles = {
            "Potato": {"soil_base": 40, "temp_base": 18, "hum_base": 60},
            "Grape":  {"soil_base": 42, "temp_base": 20, "hum_base": 55},
            "Tomato": {"soil_base": 55, "temp_base": 26, "hum_base": 60},
            "Apple":  {"soil_base": 35, "temp_base": 15, "hum_base": 50},
        }
        readings = []
        for fd in fields_data:
            profile = base_profiles[fd["crop_type"]]
            for day_offset in range(7, 0, -1):
                for hour in [6, 10, 14, 18]:
                    ts = now - timedelta(days=day_offset, hours=random.randint(0, 1), minutes=random.randint(0, 59))
                    ts = ts.replace(hour=hour)
                    # Add realistic daily variation (hotter midday, cooler morning)
                    hour_factor = 1.0 + 0.15 * (1 if hour in [10, 14] else -1)
                    readings.append(SensorReading(
                        id=uuid.uuid4(), field_id=fd["id"],
                        soil_moisture=round(profile["soil_base"] + random.uniform(-8, 8), 1),
                        temperature_c=round((profile["temp_base"] * hour_factor) + random.uniform(-3, 4), 1),
                        humidity_pct=round(profile["hum_base"] + random.uniform(-10, 12), 1),
                        created_at=ts,
                    ))
        db.bulk_save_objects(readings)
        db.commit()
        print(f"   ✅ {len(readings)} lectures capteurs insérées")

        # ════════════════════════════════════════
        # 6. NDVI RECORDS — 10 weeks per field
        # ════════════════════════════════════════
        print("🛰️  Génération des données NDVI (10 semaines × 4 champs)...")
        ndvi_records = []
        ndvi_base = {"Potato": 0.70, "Grape": 0.58, "Tomato": 0.72, "Apple": 0.65}
        for fd in fields_data:
            base = ndvi_base[fd["crop_type"]]
            for week in range(10, 0, -1):
                # Simulate gradual growth
                growth = 0.02 * (10 - week)
                val = round(min(0.95, base + growth + random.uniform(-0.06, 0.06)), 3)
                status = "healthy" if val > 0.5 else "stressed" if val > 0.3 else "critical"
                ndvi_records.append(NDVIRecord(
                    id=uuid.uuid4(), field_id=fd["id"],
                    ndvi_value=val, status=status,
                    captured_at=now - timedelta(weeks=week),
                ))
        db.bulk_save_objects(ndvi_records)
        db.commit()
        print(f"   ✅ {len(ndvi_records)} enregistrements NDVI insérés")

        # ════════════════════════════════════════
        # 7. IRRIGATION LOGS — 2-3 per field
        # ════════════════════════════════════════
        print("💦 Génération des logs d'irrigation...")
        irr_logs = []
        for fd in fields_data:
            for i in range(random.randint(2, 4)):
                rec_min = random.choice([15, 20, 25, 30, 45])
                exec_min = rec_min + random.randint(-5, 5) if random.random() > 0.3 else None
                irr_logs.append(IrrigationLog(
                    id=uuid.uuid4(), field_id=fd["id"],
                    recommended_minutes=rec_min,
                    executed_minutes=exec_min,
                    water_estimate_m3=round(rec_min * fd["area_ha"] * 0.008 + random.uniform(0, 0.5), 2),
                    status=random.choice(["done", "done", "done", "pending", "skipped"]),
                    created_at=now - timedelta(days=random.randint(0, 6), hours=random.randint(5, 18)),
                ))
        db.bulk_save_objects(irr_logs)
        db.commit()
        print(f"   ✅ {len(irr_logs)} logs d'irrigation insérés")

        # ════════════════════════════════════════
        # 8. DISEASE SCANS
        # ════════════════════════════════════════
        print("🔬 Génération des scans de maladies...")
        disease_catalog = {
            "Tomato": [
                ("Tomato___Bacterial_spot", 0.92), ("Tomato___Early_blight", 0.87),
                ("Tomato___healthy", 0.96), ("Tomato___healthy", 0.94),
                ("Tomato___Late_blight", 0.83), ("Tomato___healthy", 0.98),
            ],
            "Grape": [
                ("Grape___Black_rot", 0.89), ("Grape___healthy", 0.95),
                ("Grape___Esca_(Black_Measles)", 0.78), ("Grape___healthy", 0.97),
            ],
            "Potato": [
                ("Potato___Early_blight", 0.88), ("Potato___Late_blight", 0.91),
                ("Potato___healthy", 0.95), ("Potato___healthy", 0.97),
            ],
            "Apple": [
                ("Apple___Apple_scab", 0.85), ("Apple___Black_rot", 0.89),
                ("Apple___Cedar_apple_rust", 0.92), ("Apple___healthy", 0.96),
            ],
        }
        scans = []
        for fd in fields_data:
            for disease_name, base_conf in disease_catalog.get(fd["crop_type"], []):
                scans.append(DiseaseScan(
                    id=uuid.uuid4(), field_id=fd["id"],
                    crop_type=fd["crop_type"],
                    image_url=f"/uploads/scans/{fd['crop_type'].lower()}_{uuid.uuid4().hex[:8]}.jpg",
                    predicted_disease=disease_name,
                    confidence=round(base_conf + random.uniform(-0.05, 0.03), 3),
                    created_at=now - timedelta(days=random.randint(0, 14), hours=random.randint(6, 20)),
                ))
        db.bulk_save_objects(scans)
        db.commit()
        print(f"   ✅ {len(scans)} scans de maladies insérés")

        # ════════════════════════════════════════
        # 9. ANIMALS (livestock)
        # ════════════════════════════════════════
        print("🐄 Génération du cheptel...")
        animals_data = [
            ("TN-OV-001", "Ovin",   "Barbarine",           "2023-03-15"),
            ("TN-OV-002", "Ovin",   "Queue Fine de l'Ouest","2022-08-20"),
            ("TN-OV-003", "Ovin",   "Barbarine",           "2024-01-10"),
            ("TN-BV-001", "Bovin",  "Brune de l'Atlas",    "2022-05-01"),
            ("TN-BV-002", "Bovin",  "Holstein",            "2023-11-22"),
            ("TN-CP-001", "Caprin", "Chèvre de Medenine",  "2024-04-12"),
            ("TN-CP-002", "Caprin", "Alpine",              "2023-07-30"),
            ("TN-AV-001", "Volaille","Poule Fermière",     "2024-09-01"),
        ]
        for i, (tag, species, breed, bd) in enumerate(animals_data):
            db.add(Animal(
                id=ANIMAL_IDS[i], farm_id=FARM_ID,
                tag_id=tag, species=species, breed=breed,
                birth_date=datetime.strptime(bd, "%Y-%m-%d"),
            ))
        db.commit()

        # ════════════════════════════════════════
        # 10. VACCINATION LOGS
        # ════════════════════════════════════════
        print("💉 Génération des vaccinations...")
        vaccines = [
            ("Antirabique", "1 ml IM", "Dr. Slim Trabelsi"),
            ("Entérotoxémie", "2 ml SC", "Dr. Hela Bouazizi"),
            ("Brucellose Rev-1", "1 dose SC", "Dr. Slim Trabelsi"),
            ("Charbon bactéridien", "0.5 ml SC", "Dr. Karim Hamdi"),
        ]
        vacc_objects = []
        for animal_id in ANIMAL_IDS[:5]:
            v = random.choice(vaccines)
            vacc_date = now - timedelta(days=random.randint(10, 60))
            vacc_objects.append(VaccinationLog(
                id=uuid.uuid4(), animal_id=animal_id,
                vaccine_name=v[0], dose=v[1], vet_name=v[2],
                date=vacc_date, next_due_date=vacc_date + timedelta(days=180),
            ))
        db.bulk_save_objects(vacc_objects)
        db.commit()
        print(f"   ✅ {len(vacc_objects)} vaccinations insérées")

        # ════════════════════════════════════════
        # 11. TREATMENT LOGS
        # ════════════════════════════════════════
        print("💊 Génération des traitements...")
        treatments = [
            ("Parasitose interne", "Ivermectine", "0.2 mg/kg", "Traitement antiparasitaire de routine"),
            ("Boiterie", "Anti-inflammatoire", "1 ml/50kg", "Légère inflammation du sabot droit"),
            ("Mammite", "Amoxicilline", "1 tube intra-mammaire", "Guérison complète en 5 jours"),
        ]
        treat_objects = []
        for animal_id in ANIMAL_IDS[:4]:
            t = random.choice(treatments)
            treat_objects.append(TreatmentLog(
                id=uuid.uuid4(), animal_id=animal_id,
                diagnosis=t[0], medicine=t[1], dosage=t[2], vet_note=t[3],
                date=now - timedelta(days=random.randint(5, 30)),
            ))
        db.bulk_save_objects(treat_objects)
        db.commit()
        print(f"   ✅ {len(treat_objects)} traitements insérés")

        # ════════════════════════════════════════
        # 12. ALERTS
        # ════════════════════════════════════════
        print("⚠️  Génération des alertes...")
        alerts_data = [
            ("Stress hydrique détecté", "high", "open", FIELD_IDS[0], "Humidité du sol sous le seuil critique dans l'Oliveraie. Irrigation recommandée d'urgence."),
            ("Température élevée", "medium", "open", FIELD_IDS[2], "Pic de chaleur prévu — protégez les plants de tomates avec un voile d'ombrage."),
            ("Maladie détectée: Mildiou", "critical", "open", FIELD_IDS[1], "Scan IA a détecté du Black Rot sur 3 pieds de vigne. Traitement fongicide recommandé."),
            ("Capteur hors-ligne", "low", "resolved", FIELD_IDS[3], "Le capteur n°4 du champ de maïs a été reconnecté après maintenance."),
            ("Irrigation incomplète", "medium", "resolved", FIELD_IDS[0], "L'irrigation programmée n'a atteint que 60% de la durée recommandée."),
            ("NDVI en baisse", "high", "open", FIELD_IDS[3], "L'indice NDVI du maïs a chuté de 0.15 en 2 semaines — vérifiez la fertilisation."),
            ("Vaccination à prévoir", "low", "open", None, "3 ovins nécessitent un rappel vaccinal entérotoxémie dans les prochains 10 jours."),
        ]
        for atype, sev, status, field_id, note in alerts_data:
            db.add(Alert(
                id=uuid.uuid4(), farm_id=FARM_ID,
                field_id=field_id, type=atype,
                severity=sev, status=status, note=note,
                created_at=now - timedelta(days=random.randint(0, 5), hours=random.randint(0, 23)),
            ))
        db.commit()
        print(f"   ✅ {len(alerts_data)} alertes insérées")

        # ════════════════════════════════════════
        # DONE
        # ════════════════════════════════════════
        print("\n" + "="*50)
        print("🎉 Base de données peuplée avec succès !")
        print("="*50)
        print(f"""
📊 Résumé:
   🏛️  1 coopérative (Cap Bon)
   🌾 1 ferme (Domaine Ben Salem)
   👤 1 utilisateur (farmer@agrismart.tn / Farmer123!)
   🏕️  4 parcelles (Olive, Vigne, Tomate, Maïs)
   📡 {len(readings)} lectures capteurs (7 jours)
   🛰️  {len(ndvi_records)} enregistrements NDVI (10 semaines)
   💦 {len(irr_logs)} logs d'irrigation
   🔬 {len(scans)} scans de maladies
   🐄 {len(animals_data)} animaux
   💉 {len(vacc_objects)} vaccinations
   💊 {len(treat_objects)} traitements
   ⚠️  {len(alerts_data)} alertes
        """)

    except Exception as e:
        db.rollback()
        print(f"\n❌ Erreur: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    print("🌿 SANIA — Seed Script")
    print("=" * 50)
    seed()
