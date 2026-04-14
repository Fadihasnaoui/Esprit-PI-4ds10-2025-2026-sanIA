import sys
import os
import numpy as np
import tensorflow as tf
from pathlib import Path

# Add src to path
sys.path.append(str(Path("c:/Users/fadih/Desktop/ProjetPi/crop_disease_detection/src")))

try:
    from model_factory import build_model
    import shap
    import config
    
    print("Loading model...")
    model, _ = build_model("MobileNetV3Large")
    model_path = Path("c:/Users/fadih/Desktop/ProjetPi/crop_disease_detection/models/best_model.keras")
    model.load_weights(model_path)
    print("Model loaded.")
    
    # Dummy data
    background = np.random.random((2, 224, 224, 3)).astype("float32")
    test_image = np.random.random((1, 224, 224, 3)).astype("float32")
    
    print("Creating explainer...")
    explainer = shap.GradientExplainer(model, background)
    
    print("Calculating shap_values...")
    shap_values = explainer.shap_values(test_image)
    
    print(f"Type of shap_values: {type(shap_values)}")
    if isinstance(shap_values, list):
        print(f"Length of list: {len(shap_values)}")
        print(f"Shape of first element: {np.shape(shap_values[0])}")
    else:
        print(f"Shape of array: {np.shape(shap_values)}")

except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
