import requests
import json
import time

# Simulation script to test Geofence OUT OF BOUNDS alert.
# Requires an animal ID existing in the DB. We'll pick the first one.

base_url = "http://127.0.0.1:8000/api/v1"

def send_telemetry():
    # 1. Get first animal
    r = requests.get(f"{base_url}/animals/", headers={"Authorization": "Bearer fake"}) # the get doesn't enforce strict auth if we disable it in test or wait, auth is enforced. 
    # Let's bypass auth by sending the POST ingest directly, it only needs the target_animal API key
    
    # Just send generic ingest to some tag_id. If tag_id doesn't exist, it throws 404.
    # Let's supply tag_id="B-001" or whatever is common. Let's try 5 common tag_ids.
    tag_ids = ["B-101", "B-001", "V-001", "O-001"]
    
    for tag in tag_ids:
        print(f"Trying to ingest for tag: {tag}")
        payload = {
            "tag_id": tag,
            "heart_rate": 70.0,
            "temperature_c": 38.5,
            "activity_level": "GRAZING",
            "latitude": 36.65, # far away!
            "longitude": 10.55,
            "weight_kg": 400.0
        }
        res = requests.post(
            f"{base_url}/livestock_telemetry/ingest", 
            json=payload,
            headers={"x-api-key": "sania_gateway_2026"}
        )
        print(res.status_code, res.text)
        if res.status_code == 200:
            print("Successfully sent telemetry for", tag)
            break

if __name__ == "__main__":
    send_telemetry()
