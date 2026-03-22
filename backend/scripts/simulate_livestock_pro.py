import asyncio
import httpx
import random
import time
from uuid import UUID
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import SessionLocal
from app.models.all_models import Animal

API_URL = "http://127.0.0.1:8000/api/v1/livestock_telemetry/ingest"

# Grombalia Farm coordinates roughly
BASE_LAT = 36.60
BASE_LNG = 10.49

async def simulate_animal(animal_data, client: httpx.AsyncClient):
    animal_id = animal_data["id"]
    species = animal_data["species"]
    
    lat = BASE_LAT + random.uniform(-0.005, 0.005)
    lng = BASE_LNG + random.uniform(-0.005, 0.005)
    
    print(f"[{animal_data['tag_id']}] Simulation started. Species: {species}")
    
    # Introduce random personality/state for each animal over time
    while True:
        # Move randomly
        lat += random.uniform(-0.0001, 0.0001)
        lng += random.uniform(-0.0001, 0.0001)
        
        # Determine activity state dynamically with random anomalies
        rnd = random.random()
        anomaly = None
        
        if rnd < 0.02:
            anomaly = "FEVER"
            state = "RESTING"
        elif rnd < 0.05:
            anomaly = "PANIC"
            state = "RUNNING"
        else:
            state = random.choices(["RESTING", "EATING", "WALKING", "RUNNING"], weights=[40, 30, 25, 5])[0]
        
        # Base HR and Temp by species roughly
        if "bovin" in species:
            hr_base = 60
            temp_base = 38.5
        elif "ovin" in species or "sheep" in species:
            hr_base = 75
            temp_base = 39.0
        elif "volaille" in species or "chicken" in species:
            hr_base = 200
            temp_base = 41.0
        else:
            hr_base = 70
            temp_base = 38.5
            
        # Adjust per activity
        if state == "RESTING":
            hr = random.uniform(hr_base - 5, hr_base + 5)
            temp = random.uniform(temp_base - 0.2, temp_base + 0.2)
        elif state == "EATING":
            hr = random.uniform(hr_base, hr_base + 10)
            temp = random.uniform(temp_base, temp_base + 0.3)
        elif state == "WALKING":
            hr = random.uniform(hr_base + 10, hr_base + 30)
            temp = random.uniform(temp_base + 0.2, temp_base + 0.5)
        else: # RUNNING
            hr = random.uniform(hr_base + 30, hr_base + 60)
            temp = random.uniform(temp_base + 0.5, temp_base + 1.2)
            
        # Apply anomaly overrides
        if anomaly == "FEVER":
            temp += random.uniform(1.0, 2.0)
            hr += random.uniform(15, 25)
        elif anomaly == "PANIC":
            hr += random.uniform(40, 80)
            
        payload = {
            "animal_id": animal_id,
            "heart_rate": round(hr, 1),
            "temperature_c": round(temp, 1),
            "activity_level": state,
            "latitude": round(lat, 6),
            "longitude": round(lng, 6)
        }
        
        try:
            response = await client.post(API_URL, json=payload, timeout=5.0)
            if response.status_code != 200:
                print(f"[{animal_data['tag_id']}] Warning: API returned {response.status_code}")
        except Exception as e:
            # We silently pass network disconnects in dev to avoid console spam
            pass
            
        await asyncio.sleep(2.0 + random.uniform(0, 1.0))

async def main():
    print("🐄 Starting Advanced PRO Livestock Simulator...")
    
    # Fetch animals from DB directly to bypass auth
    db = SessionLocal()
    animals_db = db.query(Animal).all()
    all_animals = [{"id": str(a.id), "tag_id": str(a.tag_id), "species": str(a.species).lower()} for a in animals_db]
    db.close()
    
    if not all_animals:
        print("No animals found in the database. Add some animals first.")
        return

    # Pick a subset of animals to be "online"
    random.shuffle(all_animals)
    active_count = max(1, int(len(all_animals) * 0.75))
    active_animals = all_animals[:active_count]
    
    print(f"📡 Simulating AI Data for {len(active_animals)}/{len(all_animals)} animals...")
    
    async with httpx.AsyncClient() as client:
        tasks = []
        for a in active_animals:
            tasks.append(asyncio.create_task(simulate_animal(a, client)))
            
        await asyncio.gather(*tasks)

if __name__ == "__main__":
    asyncio.run(main())
