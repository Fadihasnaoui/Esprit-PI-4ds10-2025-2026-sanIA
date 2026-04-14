import os, sys, requests, json
sys.path.append(os.getcwd())
try:
    from app.core.config import settings
    api_key = settings.AGROMONITORING_API_KEY
except:
    api_key = "00d3a8ac9f835be6d0b63bfbbed63eef8"

print("using API_KEY:", api_key)

potato_db = [
    [34.742, 10.758],
    [34.745, 10.758],
    [34.745, 10.762],
    [34.742, 10.762]
]

potato_geo = [[c[1], c[0]] for c in potato_db]
if potato_geo[0] != potato_geo[-1]:
    potato_geo.append(potato_geo[0])

polygon_payload = {
    "name": "TEST_POTATO",
    "geo_json": {
        "type": "Feature",
        "properties": {},
        "geometry": {"type": "Polygon", "coordinates": [potato_geo]}
    }
}

print("Creating polygon...")
res = requests.post(f"http://api.agromonitoring.com/agro/1.0/polygons?appid={api_key}", json=polygon_payload)
print(res.status_code, res.text)
