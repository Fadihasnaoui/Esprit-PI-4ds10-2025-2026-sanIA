"""
test_ndvi_connection.py
=======================
Run this to verify the AGROMONITORING_API_KEY is valid and the full
NDVI satellite chain will return real data for your fields.

Usage (from backend/ dir):
    python test_ndvi_connection.py
"""
import os
import sys
import requests
from datetime import datetime, timedelta

# Read .env manually
def load_env(path=".env"):
    try:
        with open(path) as f:
            for line in f:
                line = line.strip()
                if "=" in line and not line.startswith("#"):
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip())
    except FileNotFoundError:
        print(f"[WARN] .env not found at {path}")

load_env()

API_KEY = os.getenv("AGROMONITORING_API_KEY", "")

print("=" * 60)
print("NDVI / Agromonitoring Connection Test")
print("=" * 60)

if not API_KEY or API_KEY in ("votre_cle", "YOUR_KEY", ""):
    print("[FAIL] AGROMONITORING_API_KEY is not set in .env")
    sys.exit(1)

print(f"[OK]  API Key found: {API_KEY[:6]}...{API_KEY[-4:]} ({len(API_KEY)} chars)")

# --- Step 1: list existing polygons ---
poly_url = f"http://api.agromonitoring.com/agro/1.0/polygons?appid={API_KEY}"
print(f"\n[TEST] GET {poly_url[:60]}...")
try:
    r = requests.get(poly_url, timeout=15)
    print(f"       Status: {r.status_code}")
    if r.status_code == 200:
        polys = r.json()
        print(f"       Polygons on account: {len(polys) if isinstance(polys, list) else '?'}")
        if isinstance(polys, list) and polys:
            first = polys[0]
            poly_id = first.get("id")
            print(f"       First polygon: id={poly_id}  name={first.get('name')}")

            # --- Step 2: search images ---
            end_ts   = int(datetime.now().timestamp())
            start_ts = int((datetime.now() - timedelta(days=90)).timestamp())
            img_url  = (
                f"http://api.agromonitoring.com/agro/1.0/image/search"
                f"?start={start_ts}&end={end_ts}&polyid={poly_id}&appid={API_KEY}"
            )
            print(f"\n[TEST] GET image search (last 90 days)...")
            r2 = requests.get(img_url, timeout=15)
            print(f"       Status: {r2.status_code}")
            if r2.status_code == 200:
                imgs = r2.json()
                if isinstance(imgs, list) and imgs:
                    print(f"       Images found: {len(imgs)}")
                    # Find best (low cloud)
                    usable = [i for i in imgs if i.get("stats", {}).get("ndvi")]
                    usable.sort(key=lambda x: (x.get("cl", 100), -x.get("dt", 0)))
                    best = usable[0] if usable else imgs[0]
                    dt   = datetime.fromtimestamp(best["dt"]).strftime("%Y-%m-%d")
                    cl   = best.get("cl", "?")
                    print(f"       Best image: date={dt}  clouds={cl}%")
                    ndvi_url = best.get("stats", {}).get("ndvi")
                    if ndvi_url:
                        print(f"\n[TEST] GET NDVI stats...")
                        r3 = requests.get(ndvi_url, timeout=15)
                        print(f"       Status: {r3.status_code}")
                        if r3.status_code == 200:
                            stats = r3.json()
                            avg   = round(float(stats.get("mean", 0) or 0), 3)
                            mn    = round(float(stats.get("min",  0) or 0), 3)
                            mx    = round(float(stats.get("max",  0) or 0), 3)
                            print(f"       avg_ndvi={avg}  min={mn}  max={mx}")
                            print(f"\n[RESULT] Success! Your API key is valid and returns real NDVI data.")
                            print(f"         avg_ndvi = {avg} ({'Excellent' if avg>=0.6 else 'Bon' if avg>=0.4 else 'Modere' if avg>=0.2 else 'Faible'})")
                        else:
                            print(f"       [FAIL] NDVI stats returned {r3.status_code}: {r3.text[:200]}")
                    else:
                        print("       [WARN] No NDVI stats URL on best image.")
                else:
                    print(f"       [WARN] No images found in last 90 days. Try extending the range.")
            else:
                print(f"       [FAIL] {r2.text[:200]}")
        else:
            print("       No polygons yet. Create a field with a polygon in the app first.")
    elif r.status_code == 401:
        print(f"       [FAIL] 401 Unauthorized — API key is invalid or expired.")
        print(f"       Get a fresh free key at: https://agromonitoring.com/dashboard/new-api-key")
    else:
        print(f"       [FAIL] {r.text[:300]}")
except Exception as ex:
    print(f"[ERROR] Connection failed: {ex}")
    print("        Check your internet connection.")

print("\n" + "=" * 60)
