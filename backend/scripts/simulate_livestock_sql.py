import asyncio
import httpx
import random
import re
import os
from datetime import datetime

# Absolute path to the SQL file based on repo structure
SQL_FILE_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "Data", "Livestock", "livestock_seed.sql")

API_URL = "http://127.0.0.1:8000/api/v1/livestock_telemetry/ingest"

# Grombalia Farm coordinates
BASE_LAT = 36.6
BASE_LNG = 10.49

def parse_weight_records():
    print(f"Reading SQL file from {SQL_FILE_PATH}")
    records = []
    try:
        with open(SQL_FILE_PATH, 'r', encoding='utf-8') as f:
            content = f.read()
            
            # Find the INSERT INTO weight_records block
            match = re.search(r'INSERT INTO weight_records \(livestock_id, weight_kg, recorded_at\) VALUES\s*([\s\S]*?);', content)
            if match:
                values_str = match.group(1)
                # Parse tuples
                tuple_matches = re.findall(r"\('([^']+)',\s*([\d\.]+),\s*'([^']+)'\)", values_str)
                for t in tuple_matches:
                    animal_id, weight, date_str = t
                    records.append({
                        "animal_id": animal_id,
                        "weight_kg": float(weight),
                        "timestamp": datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S")
                    })
    except Exception as e:
        print(f"Error parsing SQL file: {e}")
        
    # Sort chronologically
    records.sort(key=lambda x: x['timestamp'])
    return records

async def main():
    print("🐄 Starting SQL Playback Simulator (Local Fallback)...")
    records = parse_weight_records()
    print(f"Found {len(records)} weight records to stream.")
    
    if not records:
        print("No records found, exiting.")
        return

    # To simulate continuous real-time data, we will loop through the records, 
    # emitting one every second, while augmenting it with dynamic GPS and HR data.
    
    # Keep track of animal states for map
    animal_states = {}

    async with httpx.AsyncClient() as client:
        print("📡 Starting stream...")
        
        for record in records:
            a_id = record['animal_id']
            if a_id not in animal_states:
                animal_states[a_id] = {
                    "lat": BASE_LAT + random.uniform(-0.005, 0.005),
                    "lng": BASE_LNG + random.uniform(-0.005, 0.005)
                }
            
            # Simulate slight movement
            animal_states[a_id]['lat'] += random.uniform(-0.0001, 0.0001)
            animal_states[a_id]['lng'] += random.uniform(-0.0001, 0.0001)
            
            # Determine activity state
            state = random.choices(["RESTING", "EATING", "WALKING", "RUNNING"], weights=[30, 40, 20, 10])[0]
            
            if state == "RESTING":
                hr = random.uniform(60, 70)
            elif state == "EATING":
                hr = random.uniform(65, 75)
            elif state == "WALKING":
                hr = random.uniform(75, 90)
            else: # RUNNING
                hr = random.uniform(90, 110)
                
            payload = {
                "animal_id": a_id,
                "heart_rate": round(hr, 1),
                "temperature_c": round(random.uniform(38.0, 39.5), 1),
                "activity_level": state,
                "latitude": round(animal_states[a_id]['lat'], 6),
                "longitude": round(animal_states[a_id]['lng'], 6),
                "weight_kg": record['weight_kg']
            }
            
            try:
                response = await client.post(API_URL, json=payload)
                print(f"[{a_id[:8]}] Weight: {record['weight_kg']} kg | HR: {round(hr)} bpm | Sent: {response.status_code}")
            except Exception as e:
                import traceback
                print(f"[{a_id[:8]}] Error sending telemetry: {type(e).__name__} - {e}")
                
            # Send 2 records per second to simulate time passing faster
            await asyncio.sleep(0.5)

if __name__ == "__main__":
    asyncio.run(main())
