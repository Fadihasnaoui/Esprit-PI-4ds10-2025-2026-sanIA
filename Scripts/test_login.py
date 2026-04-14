import urllib.request
import urllib.parse
import json

url = "http://127.0.0.1:8000/api/v1/auth/login"
data = urllib.parse.urlencode({
    "username": "fadihasnaoui11@gmail.com",
    "password": "password123",
    "grant_type": "password"
}).encode()

req = urllib.request.Request(url, data=data, method="POST")
req.add_header("Content-Type", "application/x-www-form-urlencoded")

try:
    with urllib.request.urlopen(req) as response:
        res_data = response.read().decode('utf-8')
        print(f"Login Success: {res_data}")
except Exception as e:
    if hasattr(e, 'read'):
        print(f"Login Error: {e.read().decode()}")
    else:
        print(f"Login Error: {e}")
