"""
Disease detection service using TFLite model.
Loads best_model.tflite and runs inference on uploaded images.
"""
import os
import io
import logging
import numpy as np
from PIL import Image
from typing import Tuple, List, Dict

logger = logging.getLogger(__name__)

# Try full tensorflow first (TF 2.20 installed in this venv)
Interpreter = None
_tf_error = None

try:
    import tensorflow as tf
    # Suppress the deprecation warning for tf.lite.Interpreter
    import warnings
    warnings.filterwarnings("ignore", category=UserWarning, module="tensorflow")
    Interpreter = tf.lite.Interpreter
    logger.info(f"TFLite Interpreter loaded from tensorflow {tf.__version__}")
except Exception as e:
    _tf_error = str(e)
    logger.warning(f"tensorflow import failed: {e}")
    try:
        import tflite_runtime.interpreter as _tflite
        Interpreter = _tflite.Interpreter
        logger.info("TFLite Interpreter loaded from tflite_runtime")
    except Exception as e2:
        logger.error(f"tflite_runtime import also failed: {e2}")
        Interpreter = None

# Model paths
MODEL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")
MODEL_PATH = os.path.join(MODEL_DIR, "best_model.tflite")
SEVERITY_MODEL_PATH = os.path.join(MODEL_DIR, "severity_model_v3.tflite")

# Log on module load
logger.info(f"[disease_detection] MODEL_PATH = {MODEL_PATH}")
logger.info(f"[disease_detection] SEVERITY_MODEL_PATH = {SEVERITY_MODEL_PATH}")
logger.info(f"[disease_detection] classification model exists = {os.path.exists(MODEL_PATH)}")
logger.info(f"[disease_detection] severity model exists = {os.path.exists(SEVERITY_MODEL_PATH)}")
logger.info(f"[disease_detection] Interpreter = {Interpreter}")

# Severity thresholds
SEVERITY_LABELS = [
    {"max": 5.0,   "label": "Healthy",  "color": "#27ae60"},
    {"max": 20.0,  "label": "Low",      "color": "#f1c40f"},
    {"max": 40.0,  "label": "Moderate", "color": "#e67e22"},
    {"max": 60.0,  "label": "High",     "color": "#e74c3c"},
    {"max": 100.0, "label": "Critical", "color": "#8e44ad"},
]

# 16 disease classes in the exact order the model was trained on (alphabetical)
CLASS_NAMES: List[str] = [
    "Apple___Apple_scab",
    "Apple___Black_rot",
    "Apple___Cedar_apple_rust",
    "Apple___healthy",
    "Background_without_leaves",
    "Grape___Black_rot",
    "Grape___Esca_(Black_Measles)",
    "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)",
    "Grape___healthy",
    "Potato___Early_blight",
    "Potato___Late_blight",
    "Potato___healthy",
    "Tomato___Bacterial_spot",
    "Tomato___Early_blight",
    "Tomato___Late_blight",
    "Tomato___healthy",
]

_interpreter = None
_severity_interpreter = None


def get_severity_label(pct: float) -> Tuple[str, str]:
    """Determine severity label and color based on percentage of leaf area affected."""
    for s in SEVERITY_LABELS:
        if pct < s["max"]:
            return s["label"], s["color"]
    return "Critical", "#8e44ad"


def _get_interpreter(model_path: str):
    """Lazy-load the TFLite interpreter (singleton)."""
    if Interpreter is None:
        raise RuntimeError(f"No TFLite interpreter available. tf error: {_tf_error}")
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model not found at: {model_path}")
    logger.info(f"Loading TFLite model from {model_path} ...")
    interpreter = Interpreter(model_path=model_path)
    interpreter.allocate_tensors()
    return interpreter


def _get_classification_interpreter():
    global _interpreter
    if _interpreter is None:
        _interpreter = _get_interpreter(MODEL_PATH)
    return _interpreter


def _get_severity_interpreter():
    global _severity_interpreter
    if _severity_interpreter is None:
        _severity_interpreter = _get_interpreter(SEVERITY_MODEL_PATH)
    return _severity_interpreter


def preprocess_image(image_bytes: bytes, target_size: Tuple[int, int] = (224, 224), normalize: bool = False) -> np.ndarray:
    """Resize image and return Float32Array.
    - target_size: (width, height)
    - normalize: If True, scale to [0, 1]. If False, keep [0, 255].
    """
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img = img.resize(target_size, Image.LANCZOS)
    arr = np.array(img, dtype=np.float32)
    if normalize:
        arr = arr / 255.0
    return np.expand_dims(arr, axis=0)


def predict(image_bytes: bytes) -> Tuple[str, float, List[Dict]]:
    """Run disease classification."""
    interpreter = _get_classification_interpreter()
    input_details = interpreter.get_input_details()
    output_details = interpreter.get_output_details()

    input_data = preprocess_image(image_bytes)
    interpreter.set_tensor(input_details[0]["index"], input_data)
    interpreter.invoke()

    probabilities: np.ndarray = interpreter.get_tensor(output_details[0]["index"])[0]

    top5_indices = np.argsort(probabilities)[::-1][:5]
    top5 = [
        {"disease": CLASS_NAMES[i], "confidence": round(float(probabilities[i]), 4)}
        for i in top5_indices
    ]

    best_idx = int(top5_indices[0])
    return CLASS_NAMES[best_idx], round(float(probabilities[best_idx]), 4), top5


def predict_severity(image_bytes: bytes) -> Tuple[float, str, str]:
    """Run severity segmentation."""
    try:
        interpreter = _get_severity_interpreter()
        input_details = interpreter.get_input_details()
        output_details = interpreter.get_output_details()

        # Input: [1, 128, 128, 3] float32 normalized to [0, 1]
        input_data = preprocess_image(image_bytes, target_size=(128, 128), normalize=True)
        interpreter.set_tensor(input_details[0]["index"], input_data)
        interpreter.invoke()

        # Output: [1, 128, 128, 1] mask
        mask = interpreter.get_tensor(output_details[0]["index"])[0]
        diseased_pixel_count = np.sum(mask > 0.5)
        total_pixel_count = mask.size

        severity_pct = round((float(diseased_pixel_count) / total_pixel_count) * 100, 1)
        label, color = get_severity_label(severity_pct)
        return severity_pct, label, color
    except Exception as e:
        logger.error(f"Error in predict_severity: {e}")
        return 0.0, "Unknown", "#ADB5BD"


def is_model_available() -> bool:
    """Check whether models exist and interpreter is ready."""
    return (
        os.path.exists(MODEL_PATH)
        and os.path.exists(SEVERITY_MODEL_PATH)
        and Interpreter is not None
    )


def get_model_status() -> dict:
    """Return detailed status dict for the /model-status endpoint."""
    return {
        "classification_model": {
            "path": MODEL_PATH,
            "exists": os.path.exists(MODEL_PATH),
        },
        "severity_model": {
            "path": SEVERITY_MODEL_PATH,
            "exists": os.path.exists(SEVERITY_MODEL_PATH),
        },
        "interpreter_available": Interpreter is not None,
        "ready": is_model_available(),
    }
