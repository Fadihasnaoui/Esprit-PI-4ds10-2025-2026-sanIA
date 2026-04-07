from fastapi import APIRouter, UploadFile, File, HTTPException
import cv2
import numpy as np
import io

router = APIRouter()

@router.post("/auto-detect")
async def auto_detect_field_boundaries(file: UploadFile = File(...)):
    """
    Receives a satellite image and automatically detects field boundaries.
    Returns the boundaries as a list of polygon contours.
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    # Read image
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if image is None:
        raise HTTPException(status_code=400, detail="Invalid image data")

    # 1. Image Preprocessing (similar to prototype)
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    
    # 2. Edge Detection (Canny)
    # Note: Thresholds can be tuned or automated based on image contrast
    edges = cv2.Canny(blurred, 50, 150)
    
    # 3. Automatic Boundary Finding (Contours)
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    # 4. Filter and simplify polygons
    detected_polygons = []
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area > 1000:  # Ignore noise
            # Simplify contour to reduce point count (easier for GeoJSON)
            epsilon = 0.01 * cv2.arcLength(cnt, True)
            approx = cv2.approxPolyDP(cnt, epsilon, True)
            
            # Convert to standard Python list of coordinates
            coords = []
            for point in approx:
                coords.append({"x": int(point[0][0]), "y": int(point[0][1])})
            
            detected_polygons.append({
                "area_pixels": float(area),
                "coordinates": coords
            })

    return {
        "status": "success",
        "fields_detected": len(detected_polygons),
        "polygons": detected_polygons
    }

@router.post("/calculate-ndvi")
async def process_ndvi_layer(file: UploadFile = File(...)):
    """
    Mock endpoint to simulate spectral analysis for Soil Analysis (Pillar 2).
    In real production, this would expect multispectral GeoTIFF bands.
    """
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    # Simulating NDVI using Green and Red channels
    # Real NDVI formula: (NIR - Red) / (NIR + Red)
    b, g, r = cv2.split(image)
    ndvi = (g.astype(float) - r.astype(float)) / (g.astype(float) + r.astype(float) + 1e-6)
    
    # Calculate global field health score
    health_score = float(np.mean(ndvi))
    
    return {
        "average_ndvi": health_score,
        "health_description": "Healthy" if health_score > 0.1 else "Needs Attention",
        "soil_analysis_complete": True
    }
