import sys, os, requests, json
from datetime import datetime, timedelta
sys.path.append(os.getcwd())
try:
    from app.core.config import settings
    api_key = settings.AGROMONITORING_API_KEY
except:
    api_key = "00d3a8ac9f835be6d0b63bfbbed63eef8"

res = requests.get(f"http://api.agromonitoring.com/agro/1.0/polygons?appid={api_key}")
polys = res.json()
print("Polygons total:", len(polys))

end_date = int(datetime.now().timestamp())
start_date = int((datetime.now() - timedelta(days=1200)).timestamp()) # Try 1200 days safely

for p in polys[-5:]:
    poly_id = p.get('id')
    name = p.get('name')
    area = p.get('area')
    url = f"http://api.agromonitoring.com/agro/1.0/image/search?start={start_date}&end={end_date}&polyid={poly_id}&appid={api_key}"
    img_res = requests.get(url)
    images = img_res.json()
    print(f"ID:{poly_id} | Area:{area} | Name:{name} | Images:{len(images) if isinstance(images, list) else images}")
