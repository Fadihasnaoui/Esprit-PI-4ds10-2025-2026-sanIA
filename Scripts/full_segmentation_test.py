import requests
import cv2
import numpy as np
import os
import time

# 1. Create a dummy satellite image
image = np.zeros((500, 500, 3), dtype=np.uint8)
# Field 1: High NDVI (Healthy Green)
cv2.rectangle(image, (50, 50), (200, 200), (45, 160, 45), -1)   
# Field 2: Medium NDVI (Developing)
cv2.rectangle(image, (250, 50), (450, 250), (75, 135, 75), -1)  
# Field 3: Low NDVI (Soil/Harvested)
cv2.rectangle(image, (50, 250), (450, 450), (105, 85, 55), -1)  

test_filename = "test_field.jpg"
cv2.imwrite(test_filename, image)

print(f"✅ Step 1: Created {test_filename}")

# 2. Define the API URL (Standard FastAPI port)
URL = "http://localhost:8000/api/v1/segmentation"

print("\n--- Testing Sania AgriSmart Segmentation API ---")

try:
    # 3. Test Automatic Boundary Detection
    with open(test_filename, "rb") as f:
        print("🛰️  Step 2: Sending image for Boundary Detection...")
        response = requests.post(f"{URL}/auto-detect", files={"file": f})
        
        if response.status_code == 200:
            data = response.json()
            print(f"✔️  Success! Fields Detected: {data.get('fields_detected')}")
            for i, poly in enumerate(data.get('polygons', [])):
                print(f"   - Field {i+1}: area of {poly.get('area_pixels')} pixels")
        else:
            print(f"❌ Failed: {response.status_code} - {response.text}")
        
    # 4. Test Soil Health Analysis (NDVI)
    with open(test_filename, "rb") as f:
        print("\n🌱 Step 3: Sending image for Soil Analysis...")
        response = requests.post(f"{URL}/calculate-ndvi", files={"file": f})
        
        if response.status_code == 200:
            data = response.json()
            print(f"✔️  Success! Health Score: {data.get('average_ndvi'):.2f}")
            print(f"📝 Description: {data.get('health_description')}")
        else:
            print(f"❌ Failed: {response.status_code} - {response.text}")

except requests.exceptions.ConnectionError:
    print(f"\n❌ Error: Could not connect to the server at {URL}.")
    print("👉 Make sure your FastAPI server is running with 'uvicorn app.main:app --reload'")

finally:
    # Clean up
    if os.path.exists(test_filename):
        # os.remove(test_filename)
        print(f"\n[Note: Test image '{test_filename}' kept for your review]")
