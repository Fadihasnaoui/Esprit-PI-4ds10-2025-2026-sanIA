import cv2
import numpy as np
import matplotlib.pyplot as plt

def create_synthetic_field_image():
    """Generates a mock satellite image with different fields for demonstration."""
    image = np.zeros((500, 500, 3), dtype=np.uint8)
    
    # Field 1: Healthy crop (High Green)
    cv2.rectangle(image, (50, 50), (200, 200), (45, 150, 45), -1)
    # Field 2: Stressed crop (Yellowish/Brown)
    cv2.rectangle(image, (250, 50), (450, 250), (80, 120, 100), -1)
    # Field 3: Harvested/Bare soil (Brown)
    cv2.rectangle(image, (50, 250), (220, 450), (100, 80, 60), -1)
    
    # Add some noise/texture to look like real land
    noise = np.random.randint(0, 20, (500, 500, 3), dtype=np.uint8)
    image = cv2.add(image, noise)
    return image

def calculate_mock_ndvi(image):
    """
    In real satellite data, NDVI = (NIR - Red) / (NIR + Red).
    Since we have an RGB image, we'll simulate the greenness index.
    """
    green = image[:,:,1].astype(float)
    red = image[:,:,2].astype(float)
    # simplified index for visualization
    ndvi = (green - red) / (green + red + 1e-6)
    return ndvi

def automatic_boundary_detection(image):
    """Detects field boundaries using edge detection and contours."""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    
    # Canny Edge Detection
    edges = cv2.Canny(blurred, 30, 100)
    
    # Find Contours (these are the polygons for your GeoJSON)
    contours, _ = cv2.find_all_contours = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    # Filter small noise contours
    fields = [cnt for cnt in contours if cv2.contourArea(cnt) > 1000]
    return fields, edges

def visualize_results(image, ndvi, edges, fields):
    plt.figure(figsize=(15, 5))
    
    plt.subplot(131)
    plt.title("Original Satellite View")
    plt.imshow(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
    
    plt.subplot(132)
    plt.title("NDVI Multi-spectral Layer")
    plt.imshow(ndvi, cmap='RdYlGn')
    plt.colorbar()
    
    plt.subplot(133)
    plt.title("Detected Field Boundaries")
    result_img = image.copy()
    cv2.drawContours(result_img, fields, -1, (255, 0, 0), 3)
    plt.imshow(cv2.cvtColor(result_img, cv2.COLOR_BGR2RGB))
    
    plt.show()
    print(f"Found {len(fields)} separate fields automatically.")

if __name__ == "__main__":
    # 1. Simulate Satellite Data
    sat_img = create_synthetic_field_image()
    
    # 2. Extract NDVI (Spectral Intelligence)
    ndvi_map = calculate_mock_ndvi(sat_img)
    
    # 3. Perform Segmentation (Boundary Detection)
    field_polygons, edge_map = automatic_boundary_detection(sat_img)
    
    # 4. Result
    # In your Backend, you would convert field_polygons to GeoJSON format
    print("--- Land Segmentation Process Complete ---")
    print("Logic: 1. Edge Detection -> 2. Countour Finding -> 3. Area Filtering")
    # visualize_results(sat_img, ndvi_map, edge_map, field_polygons)
