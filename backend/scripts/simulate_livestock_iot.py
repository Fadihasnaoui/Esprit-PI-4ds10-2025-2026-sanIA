import asyncio
import httpx
import random
import time
from uuid import UUID

# Hardcoded animals IDs matching the seed script OR dynamically fetch them?
# Let's list a few static UUIDs for simulation matching seed_data.py
ANIMAL_IDS = [
    "3bcf07da-5047-49db-abd6-ed98b9ebd9c7",
    "9f635f11-2092-493a-86a0-54e4c3fd2e58",
    "f271acb9-87c2-4a0b-93ff-0c3eb7d9434b",
    "57cf18a9-4b62-4217-ba5d-b2a0c64b6eaf",
    "0c9b0e1b-b2fb-4e78-bc4a-bfcc2cbdae0a",
]

API_URL = "http://127.0.0.1:8000/api/v1/livestock_telemetry/ingest"

# Grombalia Farm coordinates
BASE_LAT = 36.6
BASE_LNG = 10.49

async def simulate_animal(animal_id, client: httpx.AsyncClient):
    lat = BASE_LAT + random.uniform(-0.005, 0.005)
    lng = BASE_LNG + random.uniform(-0.005, 0.005)
    
    while True:
        # Simulate slight movement
        lat += random.uniform(-0.0001, 0.0001)
        lng += random.uniform(-0.0001, 0.0001)
        
        # Determine activity state
        state = random.choices(["RESTING", "EATING", "WALKING", "RUNNING"], weights=[30, 40, 20, 10])[0]
        
        # Vital signs change based on activity
        if state == "RESTING":
            hr = random.uniform(60, 70)
            temp = random.uniform(38.0, 38.5)
        elif state == "EATING":
            hr = random.uniform(65, 75)
            temp = random.uniform(38.3, 38.8)
        elif state == "WALKING":
            hr = random.uniform(75, 90)
            temp = random.uniform(38.5, 39.0)
        else: # RUNNING
            hr = random.uniform(90, 110)
            temp = random.uniform(39.0, 39.5)
            
        payload = {
            "animal_id": animal_id,
            "heart_rate": round(hr, 1),
            "temperature_c": round(temp, 1),
            "activity_level": state,
            "latitude": round(lat, 6),
            "longitude": round(lng, 6)
        }
        
        try:
            response = await client.post(API_URL, json=payload)
            print(f"[{animal_id[:8]}] Telemetry sent: {response.status_code}")
        except Exception as e:
            print(f"[{animal_id[:8]}] Error sending telemetry: {e}")
            
        # Wait 2 seconds before next ping
        await asyncio.sleep(2.0)

async def main():
    print("🐄 Starting IoT Real-Time Simulator...")
    # Fetch actual UUIDs from DB? Or run the script with a command line arg.
    # To be perfectly safe, we'll hit an endpoint to get animal IDs first.
    
    async with httpx.AsyncClient() as client:
        # First query API to get existing animal IDs to avoid foreign key constraints
        try:
            # Assumes an endpoint exists to get animals
            animals_req = await client.get("http://127.0.0.1:8000/api/v1/animals/")
            if animals_req.status_code == 200:
                animals = animals_req.json()
                active_ids = [str(a["id"]) for a in animals]
            else:
                active_ids = ANIMAL_IDS
        except:
            print("Could not connect to backend, using fallback IDs.")
            active_ids = ANIMAL_IDS
            
        print(f"📡 Simulating {len(active_ids)} animals...")
        
        tasks = []
        for a_id in active_ids:
            tasks.append(asyncio.create_task(simulate_animal(a_id, client)))
            
        await asyncio.gather(*tasks)

if __name__ == "__main__":
    asyncio.run(main())
