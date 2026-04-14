import urllib.request
import json

try:
    with urllib.request.urlopen("http://127.0.0.1:8000/") as response:
        data = response.read().decode('utf-8')
        print(f"Response: {data}")
except Exception as e:
    print(f"Error: {e}")
