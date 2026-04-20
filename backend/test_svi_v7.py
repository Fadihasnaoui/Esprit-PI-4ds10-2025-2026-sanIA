import sys, os
import importlib.util
import numpy as np
from PIL import Image

# Charger svi_service.py de facon isolee (sans FastAPI/SQLAlchemy)
spec = importlib.util.spec_from_file_location('svi_service', 'app/services/svi_service.py')
mod  = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

SVIService      = mod.SVIService
YOLO_CUSTOM_MAP = mod.YOLO_CUSTOM_MAP
COCO_MAP        = mod.COCO_MAP
ALL_SPECIES     = mod.ALL_SPECIES
SPECIES_PRIORS  = mod.SPECIES_PRIORS
CONF_LOW        = mod.CONF_LOW
CONF_HIGH       = mod.CONF_HIGH

print("--- TEST SUITE SVI v7.0 ---\n")

# T1: Singleton
svc = SVIService()
assert SVIService() is svc
print("[T1] Singleton OK")

# T2: Mapping corrige (dataset_cls.yaml)
assert YOLO_CUSTOM_MAP == {0: "Bovin", 1: "Caprin", 2: "Cheval", 3: "Ovin"}
print(f"[T2] Mapping YAML corrige: {YOLO_CUSTOM_MAP}")

# T3: COCO mapping
assert COCO_MAP[17] == "Cheval"
assert COCO_MAP[18] == "Ovin"
assert COCO_MAP[19] == "Bovin"
print(f"[T3] COCO mapping OK: {COCO_MAP}")

# T4: Attributs par defaut (avant initialize)
assert hasattr(svc, "_use_custom") and svc._use_custom == True
assert hasattr(svc, "_is_det")    and svc._is_det      == False
assert hasattr(svc, "_input_size") and svc._input_size == 640
print("[T4] Attributs singleton defaut OK")

# T5: Quality assessment
img_dark   = Image.new("RGB", (256, 256), (18, 15, 20))
img_bright = Image.new("RGB", (256, 256), (210, 205, 195))
q_d = svc._assess_quality(img_dark)
q_b = svc._assess_quality(img_bright)
assert q_d["is_dark"]  == True,   f"Image sombre non detectee: {q_d}"
assert q_d["quality"]  <  q_b["quality"]
print(f"[T5] QA | sombre={q_d['quality']:.3f} | clair={q_b['quality']:.3f}")

# T6: Preprocessing dark + good -> shape (1,3,640,640) sans NaN
q_deg = {"brightness":25,"contrast":10,"blur_var":40,"quality":0.2,
         "is_dark":True,"is_blurry":True,"is_low_ct":True}
q_ok  = {"brightness":150,"contrast":65,"blur_var":900,"quality":0.9,
         "is_dark":False,"is_blurry":False,"is_low_ct":False}
img_t  = Image.new("RGB", (128, 128), (30, 25, 20))
t_dark = svc._preprocess(img_t, q_deg, 640, True)
t_good = svc._preprocess(img_t, q_ok,  640, True)
assert t_dark.shape == (1, 3, 640, 640)
assert t_good.shape == (1, 3, 640, 640)
assert np.all(np.isfinite(t_dark)), "NaN/inf dans tenseur dark"
assert np.all(np.isfinite(t_good)), "NaN/inf dans tenseur good"
print(f"[T6] Preprocessing shape={t_dark.shape} | sans NaN/inf OK")

# T7: NMS intra-classe (supprime doublon) + inter-classe (conserve especes separees)
dets_in = [
    {"box_px": [100, 100, 50, 50], "cls_id": 0, "conf": 0.90, "all_scores": np.zeros(4)},
    {"box_px": [103, 103, 50, 50], "cls_id": 0, "conf": 0.72, "all_scores": np.zeros(4)},  # doublon (IoU ~0.88 > 0.45)
    {"box_px": [300, 300, 60, 60], "cls_id": 1, "conf": 0.85, "all_scores": np.zeros(4)},  # autre esp, zone separee -> garde
    {"box_px": [302, 302, 58, 58], "cls_id": 3, "conf": 0.78, "all_scores": np.zeros(4)},  # autre esp, meme zone (IoU ~0.92 > 0.72) -> fusionne
]
kept = svc._nms(dets_in)
# Attendu: 2 gardes (doublon cls=0 supprime, et les 2 boxes proches cls=1 et cls=3 egalement fusionnees)
assert len(kept) == 2, f"NMS: attendu 2, obtenu {len(kept)}"
print(f"[T7] NMS intra-classe: 4 candidats -> {len(kept)} gardes (doublons supprimes) OK")

# T7b: NMS multi-especes bien separees -> toutes gardees
dets_sep = [
    {"box_px": [50,  50,  60, 60], "cls_id": 0, "conf": 0.91, "all_scores": np.zeros(4)},  # Bovin  (zone A)
    {"box_px": [300, 50,  60, 60], "cls_id": 1, "conf": 0.87, "all_scores": np.zeros(4)},  # Caprin (zone B)
    {"box_px": [50,  350, 60, 60], "cls_id": 2, "conf": 0.83, "all_scores": np.zeros(4)},  # Cheval (zone C)
    {"box_px": [300, 350, 60, 60], "cls_id": 3, "conf": 0.79, "all_scores": np.zeros(4)},  # Ovin   (zone D)
]
kept_sep = svc._nms(dets_sep)
assert len(kept_sep) == 4, f"NMS multi-especes: toutes separees -> attendu 4, obtenu {len(kept_sep)}"
print(f"[T7b] NMS multi-especes: 4 especes separees -> {len(kept_sep)} gardes OK")

# T8: Validation physique
svc._use_custom = True
det_ok   = {"box_px": [200, 200, 100, 80], "cls_id": 0, "all_scores": np.zeros(4)}    # Bovin, OK
det_tiny = {"box_px": [200, 200, 1, 1],    "cls_id": 0, "all_scores": np.zeros(4)}    # trop petit
assert  svc._validate(det_ok,   640, 640, True) == True
assert  svc._validate(det_tiny, 640, 640, True) == False
print("[T8] Validation physique OK (bon / trop petit)")

# T9: CLAHE eclaire une image sombre
out_clahe = svc._clahe(img_dark)
arr_in    = np.array(img_dark,   dtype=float)
arr_clahe = np.array(out_clahe,  dtype=float)
assert arr_clahe.mean() > arr_in.mean(), "CLAHE devrait eclaircir"
print(f"[T9] CLAHE OK: {arr_in.mean():.1f} -> {arr_clahe.mean():.1f}")

# T10: Gamma correction
out_gamma = svc._gamma(img_dark, 2.0)
arr_gamma = np.array(out_gamma, dtype=float)
assert arr_gamma.mean() > arr_in.mean()
print(f"[T10] Gamma OK: {arr_in.mean():.1f} -> {arr_gamma.mean():.1f}")

# T11: Auto-levels
out_al = svc._auto_levels(img_dark)
arr_al = np.array(out_al, dtype=float)
print(f"[T11] Auto-levels OK: {arr_in.mean():.1f} -> {arr_al.mean():.1f}")

# T12: Demo fallback complet
result = svc._demo_fallback()
assert result["status"] == "success"
assert len(result["all_probabilities"]) == 4
assert result["total_detections"] >= 1
assert result["prediction"]["species"] in ALL_SPECIES
print(f"[T12] Demo fallback OK: {result['prediction']['species']} @ {result['prediction']['confidence']:.3f}")

# T13: SAHI sans modele renvoie []
big_img = Image.new("RGB", (640, 640), (80, 100, 60))
tiles_r = svc._sahi_tiles(big_img, q_ok, 0.25)
assert tiles_r == [], f"Sans session SAHI doit retourner []: {tiles_r}"
print("[T13] SAHI sans modele -> [] OK")

# T14: Seuils de confiance
assert CONF_LOW  == 0.20
assert CONF_HIGH == 0.28
print(f"[T14] Seuils LOW={CONF_LOW} / HIGH={CONF_HIGH} OK")

# T15: scan_image tombe sur demo_fallback si pas de modele
import io as io_mod
from PIL import Image as PILImage
buf = io_mod.BytesIO()
PILImage.new("RGB", (100, 100), (120, 80, 60)).save(buf, format="JPEG")
scan_result = svc.scan_image(buf.getvalue())
assert scan_result["status"] == "success"
assert "detections" in scan_result
assert "all_probabilities" in scan_result
print(f"[T15] scan_image fallback OK: {scan_result['source']}")

print()
print("============================")
print("  TOUS LES TESTS PASSES")
print("============================")
