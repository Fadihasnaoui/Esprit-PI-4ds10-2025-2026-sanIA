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
    
    print("Loading model...")
    model, _ = build_model("MobileNetV3Large")
    print(f"Model output shape: {model.output_shape}")
    
    # Dummy data - very small to be fast
    background = np.random.random((2, 224, 224, 3)).astype("float32")
    test_image = np.random.random((1, 224, 224, 3)).astype("float32")
    
    print("Creating explainer...")
    # Use only 2 background samples
    explainer = shap.GradientExplainer(model, background)
    
    print("Calculating shap_values...")
    # Use nsamples if possible, but GradientExplainer doesn't have it in the same way
    shap_values = explainer.shap_values(test_image)
    
    print(f"Type of shap_values: {type(shap_values)}")
    if isinstance(shap_values, list):
        print(f"Length of list: {len(shap_values)}")
        print(f"Shape of first element: {np.shape(shap_values[0])}")
    else:
        print(f"Shape of array: {np.shape(shap_values)}")

except Exception as e:
    print(f"Error: {e}")
