import sys
import os
import uuid
import re
import random
from datetime import datetime

# Add current dir to path to allow imports from app
sys.path.append(os.getcwd())

from sqlalchemy import select
from app.db.session import engine, SessionLocal, Base
from app.models.all_models import User, Farm, Cooperative, Animal, UserRole
from app.core import security
from app.core.config import settings

SQL_FILE_PATH = os.path.abspath(os.path.join("..", "Data", "Livestock", "livestock_seed.sql"))

print(f"--- DATABASE SETUP (Postgres & SQLite Compatible) ---")
print(f"Target DB: {settings.DATABASE_URL}")

# Try to create DB if PostgreSQL and not exists
if not settings.DATABASE_URL.startswith("sqlite"):
    try:
        import psycopg2
        # Use components to connect to default postgres DB
        conn = psycopg2.connect(
            user=settings.POSTGRES_USER,
            password=settings.POSTGRES_PASSWORD,
            host=settings.POSTGRES_SERVER,
            port=settings.POSTGRES_PORT,
            database='postgres'
        )
        conn.autocommit = True
        cur = conn.cursor()
        # Check if DB exists
        cur.execute(f"SELECT 1 FROM pg_catalog.pg_database WHERE datname = '{settings.POSTGRES_DB}'")
        exists = cur.fetchone()
        if not exists:
            print(f"Database '{settings.POSTGRES_DB}' not found. Creating it...")
            cur.execute(f"CREATE DATABASE {settings.POSTGRES_DB}")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"WARNING: Could not verify/create database '{settings.POSTGRES_DB}' manually: {e}")
        # Continue anyway, Base.metadata.create_all might work if DB already EXISTS.

# 1. Clean Slate (Drop all tables to ensure clean schema)
print("Dropping existing tables...")
try:
    Base.metadata.drop_all(bind=engine)
    print("Schema cleared.")
except Exception as e:
    print(f"WARNING: Could not drop tables (might be the first run): {e}")

# 2. Create Schema
print("Creating database schema from app models...")
Base.metadata.create_all(bind=engine)

db = SessionLocal()

try:
    # 3. Create Default Cooperative and Farm
    coop = Cooperative(name="Coopérative Centrale", location="Tunis")
    db.add(coop)
    db.flush()

    farm = Farm(name="Ferme de Gronbalia", cooperative_id=coop.id)
    db.add(farm)
    db.flush()

    # 4. Create Default User (Fellah)
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
    print(f"User 'fellah@sania.ai' created (sania123)")

    # 5. Seed Animals from SQL
    print(f"Reading SQL file: {SQL_FILE_PATH}")
    if os.path.exists(SQL_FILE_PATH):
        with open(SQL_FILE_PATH, 'r', encoding='utf-8') as f:
            content = f.read()
            # Supports both old and new seed formats
            matches = re.finditer(r"\('([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)'(?:,\s*([^,\s\)]+))?(?:,\s*([^,\s\)]+))?(?:,\s*([^,\s\)]+))?\)", content)
            
            anims = []
            count = 0
            for m in matches:
                g = m.groups()
                # Basic GPS fallback
                lat = float(g[9]) if (len(g) > 9 and g[9] and g[9] != 'NULL') else 36.60 + random.uniform(-0.015, 0.015)
                lng = float(g[10]) if (len(g) > 10 and g[10] and g[10] != 'NULL') else 10.49 + random.uniform(-0.015, 0.015)
                weight = float(g[8]) if (len(g) > 8 and g[8] and g[8] != 'NULL') else (random.uniform(200, 600) if g[2] == 'Bovin' else 50.0)

                anims.append(Animal(
                    id=str(uuid.UUID(g[0])), 
                    tag_id=g[1], species=g[2], breed=g[3], gender=g[4],
                    birth_date=datetime.strptime(g[5], "%Y-%m-%d"), 
                    entry_date=datetime.strptime(g[6], "%Y-%m-%d"),
                    status=g[7],
                    weight_kg=weight, latitude=lat, longitude=lng,
                    farm_id=farm.id
                ))
                count += 1
                
            if anims:
                db.bulk_save_objects(anims)
                db.commit()
                print(f"Successfully seeded {count} animals.")
            else:
                print("No animals found in SQL file to seed.")
    else:
        print(f"ERROR: SQL file not found at {SQL_FILE_PATH}")

except Exception as e:
    db.rollback()
    print(f"CRITICAL ERROR during setup: {e}")
finally:
    db.close()

print("--- SETUP COMPLETE ---")
