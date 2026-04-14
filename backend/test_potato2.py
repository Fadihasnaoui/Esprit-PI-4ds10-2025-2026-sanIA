import os, sys, requests, json
sys.path.append(os.getcwd())
try:
    from app.core.config import settings
    api_key = settings.AGROMONITORING_API_KEY
except:
    api_key = "00d3a8ac9f835be6d0b63bfbbed63eef8"

# Potato field ID from seed data
field_id = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"

poly_url = f"http://api.agromonitoring.com/agro/1.0/polygons?appid={api_key}"
list_res = requests.get(poly_url, timeout=10).json()
poly_id = None
for p in list_res:
    if str(field_id) in str(p.get("name")):
        poly_id = p.get("id")
        print("Found poly_id:", poly_id)
        break

if not poly_id:
    # also check TEST_POTATO
    for p in list_res:
        if "TEST_POTATO" in str(p.get("name")):
            poly_id = p.get("id")
            print("Found poly_id:", poly_id, "for TEST_POTATO")
            break

if poly_id:
    from datetime import datetime, timedelta
    end_date = int(datetime.now().timestamp())
    start_date = int((datetime.now() - timedelta(days=240)).timestamp())
    search_url = f"http://api.agromonitoring.com/agro/1.0/image/search?start={start_date}&end={end_date}&polyid={poly_id}&appid={api_key}"
    images = requests.get(search_url, timeout=10).json()
    print("Found images:", len(images) if isinstance(images, list) else images)
    if isinstance(images, list) and images:
        best_img = sorted(images, key=lambda x: x.get("cl", 100))[0]
        print("Best image clouds:", best_img.get('cl'))
        stats_ndvi_url = best_img.get("stats", {}).get("ndvi")
        img_url = best_img.get("image", {}).get("ndvi")
        print("NDVI IMG URL:", img_url)
        print("NDVI STATS URL:", stats_ndvi_url)
        if stats_ndvi_url:
            stats = requests.get(stats_ndvi_url).json()
            print("Stats:", stats)
    else:
        print("No images found.")
else:
    print("Could not find poly_id")
