"""
Direct TFLite model test — shows raw confidence scores for every class.
Run from project root: python Scripts/test_model_direct.py <image_path>
"""
import sys
import numpy as np
from PIL import Image

MODEL_PATH = "backend/app/services/models/best_model.tflite"
CLASS_NAMES = [
    "Apple___Apple_scab", "Apple___Black_rot", "Apple___Cedar_apple_rust",
    "Apple___healthy", "Background_without_leaves", "Grape___Black_rot",
    "Grape___Esca_(Black_Measles)", "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)",
    "Grape___healthy", "Potato___Early_blight", "Potato___Late_blight",
    "Potato___healthy", "Tomato___Bacterial_spot", "Tomato___Early_blight",
    "Tomato___Late_blight", "Tomato___healthy",
]

image_path = sys.argv[1] if len(sys.argv) > 1 else "2.png"

# Load model
try:
    import tensorflow as tf
    interpreter = tf.lite.Interpreter(model_path=MODEL_PATH)
except Exception:
    import tflite_runtime.interpreter as tflite
    interpreter = tflite.Interpreter(model_path=MODEL_PATH)

interpreter.allocate_tensors()
in_det  = interpreter.get_input_details()
out_det = interpreter.get_output_details()

print(f"Input dtype : {in_det[0]['dtype']}")
print(f"Input shape : {in_det[0]['shape']}")
print(f"Output dtype: {out_det[0]['dtype']}")

# Preprocess
img = Image.open(image_path).convert("RGB").resize((224, 224), Image.LANCZOS)
arr = np.array(img, dtype=np.float32)
arr = np.expand_dims(arr, axis=0)

# Run inference
interpreter.set_tensor(in_det[0]['index'], arr)
interpreter.invoke()
probs = interpreter.get_tensor(out_det[0]['index'])[0]

# Print all scores
print(f"\nImage: {image_path}")
print(f"{'Class':<45} {'Confidence':>10}")
print("-" * 57)
for name, prob in sorted(zip(CLASS_NAMES, probs), key=lambda x: -x[1]):
    print(f"{name:<45} {prob:>9.2%}")
