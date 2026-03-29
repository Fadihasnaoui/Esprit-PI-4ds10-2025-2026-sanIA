import requests
import time

url = "http://127.0.0.1:8000/api/v1/auth/login"
data = {
    "username": "farmer@agrismart.tn",
    "password": "Farmer123!"
}

print(f"DEBUG: Sending POST to {url}...")
start = time.time()
try:
    response = requests.post(url, data=data, timeout=10)
    print(f"DEBUG: Response status: {response.status_code}")
    print(f"DEBUG: Response body: {response.json()}")
except Exception as e:
    print(f"DEBUG: Error: {e}")
print(f"DEBUG: Total time: {time.time() - start:.2f}s")
