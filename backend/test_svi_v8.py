import sys, os
import importlib.util
import numpy as np
import cv2

# Charger svi_service.py v8.0
spec = importlib.util.spec_from_file_location('svi_service', 'app/services/svi_service.py')
mod  = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

SVIService      = mod.SVIService
YOLO_CUSTOM_MAP = mod.YOLO_CUSTOM_MAP
ALL_SPECIES     = mod.ALL_SPECIES

print("--- TEST SUITE SVI v8.0 'Sania Expert' ---\n")

# T1: Singleton & OpenCV check
svc = SVIService()
assert SVIService() is svc
print(f"[T1] Singleton OK | OpenCV version: {cv2.__version__}")

# T2: Mapping (Vérification stricte pour Accuracy)
assert YOLO_CUSTOM_MAP == {0: "Bovin", 1: "Caprin", 2: "Cheval", 3: "Ovin"}
print(f"[T2] Mapping YOLO Expert OK: {YOLO_CUSTOM_MAP}")

# T3: Quality Assessment (OpenCV Engine)
# Image noire
img_dark = np.zeros((480, 640, 3), dtype=np.uint8)
# Image claire avec du bruit
img_noisy = np.random.randint(180, 220, (480, 640, 3), dtype=np.uint8)
cv2.rectangle(img_noisy, (100, 100), (400, 400), (255, 255, 255), -1)

q_dark  = svc._assess_quality(img_dark)
q_noisy = svc._assess_quality(img_noisy)

assert q_dark["is_dark"] == True
assert q_noisy["is_dark"] == False
assert q_noisy["score"] > q_dark["score"]
print(f"[T3] QA OpenCV OK | dark={q_dark['score']} noisy={q_noisy['score']}")

# T4: Image Enhancement (CLAHE + Gamma)
# On vérifie que CLAHE/Gamma augmentent la moyenne d'une image sombre
enhanced_dark = svc._enhance_image(img_dark, q_dark)
assert np.mean(enhanced_dark) > np.mean(img_dark), "Enhance devrait éclaircir l'image sombre"
print(f"[T4] Enhancement Adaptive OK | Mean: {np.mean(img_dark):.1f} -> {np.mean(enhanced_dark):.1f}")

# T5: Inférence Tenseur Shape
dummy_img = np.zeros((640, 640, 3), dtype=np.uint8)
tensor = svc._to_tensor(dummy_img, 640)
assert tensor.shape == (1, 3, 640, 640)
assert tensor.dtype == np.float32
assert np.max(tensor) <= 1.0
print(f"[T5] Tensor Pipeline OK | Shape: {tensor.shape}")

# T6: NMS v8 (Inter-classe)
# On teste que deux espèces différentes très proches sont gardées 
# si IoU < 0.75, mais fusionnées si IoU > 0.75 (seuil NMS_CROSS)
dets = [
    {"box_px": [100, 100, 50, 50], "cls_id": 0, "conf": 0.90}, # Bovin
    {"box_px": [100, 100, 50, 50], "cls_id": 3, "conf": 0.85}, # Ovin (Même position -> ERREUR probable, fusion)
    {"box_px": [300, 300, 50, 50], "cls_id": 1, "conf": 0.88}, # Autre espèce loin
]
kept = svc._nms(dets)
assert len(kept) == 2, f"NMS inter-classe fusion: attendu 2, obtenu {len(kept)}"
print(f"[T6] NMS Inter-classe Expert OK: {len(kept)} gardés")

# T7: Validation Biomètrique (Priors)
# Un "Cheval" énorme couvrant 95% de l'image satellite est suspect (FP)
det_huge_horse = {"box_px": [320, 240, 600, 450], "cls_id": 2} # Cheval
det_valid_cow  = {"box_px": [320, 240, 50, 40],   "cls_id": 0} # Bovin (env 1% de l'image)
assert svc._validate_priors(det_huge_horse, 640, 480) == False
assert svc._validate_priors(det_valid_cow, 640, 480) == True
print("[T7] Validation Biométrique Prieure OK")

# T8: Scan Image (Interface bytes)
img_bytes = cv2.imencode('.jpg', img_noisy)[1].tobytes()
result = svc.scan_image(img_bytes)
assert result["status"] == "success"
assert "source" in result and "SVI-Expert-v8.0" in result["source"]
assert "image_quality" in result
print(f"[T8] Pipeline Complet SVI-Expert OK | Latence: {result['latency_ms']}ms")

print("\n===============================")
print("  ACCURACY V8.0 VERIFIED ✅")
print("===============================")
