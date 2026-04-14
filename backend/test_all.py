import os, sys, requests, json
from datetime import datetime, timedelta
sys.path.append(os.getcwd())
try:
    from app.core.config import settings
    api_key = settings.AGROMONITORING_API_KEY
except:
    api_key = "00d3a8ac9f835be6d0b63bfbbed63eef8"

start_date = int((datetime.now() - timedelta(days=240)).timestamp())
end_date = int(datetime.now().timestamp())

poly_url = f"http://api.agromonitoring.com/agro/1.0/polygons?appid={api_key}"
try:
    polys = requests.get(poly_url, timeout=10).json()
    print("Found {} polygons".format(len(polys) if isinstance(polys, list) else 0))
    for p in polys:
        poly_id = p.get("id")
        name = p.get("name")
        search_url = f"http://api.agromonitoring.com/agro/1.0/image/search?start={start_date}&end={end_date}&polyid={poly_id}&appid={api_key}"
        res = requests.get(search_url, timeout=10)
        images = res.json()
        print(f"Polygon '{name}' (ID: {poly_id}) -> Images: {len(images) if isinstance(images, list) else images}")
except Exception as e:
    print("Error:", e)
