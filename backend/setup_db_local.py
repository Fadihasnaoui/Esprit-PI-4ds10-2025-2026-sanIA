import sys
import os
import uuid
import re
from datetime import datetime

# Add current dir to path to allow imports from app
sys.path.append(os.getcwd())

from sqlalchemy import select
from app.db.session import engine, SessionLocal, Base
from app.models.all_models import User, Farm, Cooperative, Animal, UserRole
from app.core import security

# Path setup
SQL_FILE_PATH = os.path.abspath(os.path.join("..", "Data", "Livestock", "livestock_seed.sql"))
DB_PATH = os.path.join(os.getcwd(), "sania_local.db")

print(f"--- DATABASE SETUP (V2: Schema Match) ---")
print(f"Target DB: {DB_PATH}")

# 1. Clean Slate (Remove DB to clear locks/mismatched schema)
if os.path.exists(DB_PATH):
    try:
        # Close any existing connections if possible, but OS remove is best
        os.remove(DB_PATH)
        print("Existing database removed to fix schema mismatch.")
    except Exception as e:
        print(f"WARNING: Could not remove existing database: {e}")

# 2. Create Schema using the REAL models
print("Creating database schema from app models...")
Base.metadata.create_all(bind=engine)

db = SessionLocal()

try:
    # 3. Create Default Cooperative and Farm
    coop = Cooperative(name="Coopérative Centrale")
    db.add(coop)
    db.flush()

    farm = Farm(name="Ferme de Gronbalia", cooperative_id=coop.id)
    db.add(farm)
    db.flush()

    # 4. Create Default User (Fellah)
    # password is 'sania123'
    # Use the app's own security module for hashing to be 100% sure
    password = "sania123"
    password_hash = security.get_password_hash(password)
    
    user = User(
        email="fellah@sania.ai",
        name="Fellah",
        password_hash=password_hash,
        role=UserRole.FARMER,
        farm_id=farm.id,
        cooperative_id=coop.id
    )
    db.add(user)
    db.commit()
    print(f"User 'fellah@sania.ai' created (Hash: {password_hash})")

    # 5. Seed Animals from SQL
    print(f"Reading SQL file: {SQL_FILE_PATH}")
    if os.path.exists(SQL_FILE_PATH):
        with open(SQL_FILE_PATH, 'r', encoding='utf-8') as f:
            content = f.read()
            start_marker = "INSERT INTO livestock (id, tag_number, species, breed, gender, birth_date, entry_date, status) VALUES"
            if start_marker in content:
                start_idx = content.find(start_marker) + len(start_marker)
                end_idx = content.find(";", start_idx)
                values_str = content[start_idx:end_idx]
                
                # Regex to extract tuples
                tuple_matches = re.findall(r"\('([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)'\)", values_str)
                print(f"Found {len(tuple_matches)} animals to seed.")
                
                import random
                anims = []
                for t in tuple_matches:
                    # Base GPS for Grombalia region
                    lat = 36.60 + (random.uniform(-0.015, 0.015))
                    lng = 10.49 + (random.uniform(-0.015, 0.015))
                    
                    # Random weight for seeding demonstration
                    weight = random.uniform(200, 650) if t[2] == 'Bovin' else random.uniform(30, 80)
                    
                    anims.append(Animal(
                        id=str(uuid.UUID(t[0])), 
                        tag_id=t[1], 
                        species=t[2], 
                        breed=t[3], 
                        gender=t[4],
                        birth_date=datetime.strptime(t[5], "%Y-%m-%d"), 
                        entry_date=datetime.strptime(t[6], "%Y-%m-%d"),
                        status=t[7],
                        weight_kg=weight,
                        latitude=lat,
                        longitude=lng,
                        farm_id=farm.id
                    ))
                db.bulk_save_objects(anims)
                db.commit()
                print(f"Successfully seeded {len(anims)} animals with GPS and full details.")
            else:
                print("ERROR: Could not find INSERT marker in SQL file.")
    else:
        print(f"ERROR: SQL file not found at {SQL_FILE_PATH}")

    db.commit()
except Exception as e:
    db.rollback()
    print(f"CRITICAL ERROR during setup: {e}")
finally:
    db.close()

print("--- SETUP COMPLETE ---")
