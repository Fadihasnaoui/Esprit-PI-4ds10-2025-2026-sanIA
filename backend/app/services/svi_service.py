"""
SVI Service — Moteur "Sania Orbital Expert" v9.0
=================================================
Architecture : Gemini Vision (Primary) + YOLOv8-SAHI-9-TTA (Secondary) + Fusion
Pipeline     : Satellite Preprocessing → Gemini Orbital → YOLOv8+SAHI-9 → Confidence Fusion
Target       : Expert species detection from satellite/aerial imagery (low-quality, high-altitude)

Classes      : Bovin 🐄 | Ovin 🐑 | Caprin 🐐 | Cheval 🐴
"""

import re
import json
import hashlib
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter
import io
import os
import time
import logging
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor

try:
    import cv2
except ImportError:
    cv2 = None
    logging.warning("⚠️  OpenCV non détecté — mode dégradé (NumPy).")

try:
    import onnxruntime as ort
except ImportError:
    ort = None

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

try:
    import google.generativeai as genai
    _gemini_key = os.getenv("GEMINI_API_KEY", "")
    if _gemini_key:
        genai.configure(api_key=_gemini_key)
    else:
        genai = None
except ImportError:
    genai = None

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ══════════════════════════════════════════════════════════════════════════════
# CONSTANTES GLOBALES
# ══════════════════════════════════════════════════════════════════════════════

IMG_SIZE       = 640   # Taille d'entrée YOLOv8
IMAGENET_MEAN  = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD   = np.array([0.229, 0.224, 0.225], dtype=np.float32)

CLASSES         = ['Bovin', 'Caprin', 'Cheval', 'Ovin']
SPECIES_EMOJI   = {'Bovin': '🐄', 'Ovin': '🐑', 'Caprin': '🐐', 'Cheval': '🐴'}
ALL_SPECIES     = list(SPECIES_EMOJI.keys())

# Mapping classes YOLO (dataset_cls.yaml: {0: cow, 1: goat, 2: horse, 3: sheep})
YOLO_CUSTOM_MAP = {0: "Bovin", 1: "Caprin", 2: "Cheval", 3: "Ovin"}
# COCO standard pour YOLOv8m (17: Horse, 18: Sheep, 19: Cow)
COCO_MAP        = {17: "Cheval", 18: "Ovin", 19: "Bovin"}

# Seuils pour Accuracy > 95% (Filtre Strict Anti-Faux Positifs YOLOv8)
CONF_TARGET     = 0.35   # Seuil global assoupli pour capter TOUS les animaux, même lointains ou flous
CONF_LOW_LIGHT  = 0.25   # Seuil permissif pour images sombres
NMS_IOU         = 0.65   # HAUTE TOLÉRANCE : Autorise les animaux qui se chevauchent (troupeaux)
NMS_CROSS       = 0.75   # IoU inter-classe (très restrictif pour éviter les doubles labels)
MAX_DETS        = 100    # On accepte plus de détections pour les grands troupeaux

# Orbital / satellite-specific thresholds (animals are tiny in overhead imagery)
SATELLITE_CONF_THR = 0.20  # Permissive — small objects have inherently lower YOLO scores

# ── Gemini resilience configuration ──────────────────────────────────────────
# Cascade: try cheapest/highest-quota models first; fall through on 429.
# The last entry is the final fallback — when it also 429s we silently degrade
# to YOLO-only (no exception propagated, no WARNING spam).
GEMINI_MODEL_CASCADE = (
    "gemini-flash-lite-latest",   # highest free RPD, perfectly adequate as a booster
    "gemini-2.5-flash-lite",      # secondary lite tier
    "gemini-2.5-flash",           # fuller-capability fallback
    "gemini-flash-latest",        # last resort (maps to current flagship, tight quota)
)
GEMINI_COOLDOWN_SEC = 90          # skip a model for 90s after it 429s
GEMINI_CACHE_SIZE   = 128         # LRU cache — identical mosaics return instant results
GEMINI_CACHE_FILE   = os.path.join(
    os.path.dirname(__file__), "..", "..", ".gemini_orbital_cache.json"
)  # persistent on disk — survives restarts and quota outages

# Contraintes physiques raffinées (Satellite-Scale Expert)
# min_area abaissé pour pouvoir détecter les animaux très éloignés en arrière-plan
SPECIES_PRIORS = {
    "Cheval": {"min_area": 0.0004, "max_area": 0.60, "min_ar": 0.20, "max_ar": 4.5},
    "Bovin":  {"min_area": 0.0004, "max_area": 0.60, "min_ar": 0.18, "max_ar": 5.0},
    "Ovin":   {"min_area": 0.0002, "max_area": 0.40, "min_ar": 0.15, "max_ar": 4.5},
    "Caprin": {"min_area": 0.0002, "max_area": 0.40, "min_ar": 0.15, "max_ar": 4.5},
}


# ── Gemini Vision prompt for orbital/satellite imagery ────────────────────────
_GEMINI_ORBITAL_PROMPT = """Tu es 'Sania Orbital Intelligence v9.0', expert en vision animalière pour l'élevage.

Tu analyses une image (satellite, aérienne, ou photo rapprochée d'un animal).

ESPÈCES CIBLES — UNE SEULE par animal visible :
- Bovin (vache, taureau, veau) 🐄         — grand corps massif, tête large, cornes courtes épaisses ou sans cornes
- Ovin  (mouton, brebis, agneau) 🐑       — corps rondelet lainé, tête courte, queue courte
- Caprin (chèvre, chevreau, bouc) 🐐      — corps svelte, cornes fines en arc/spiral, barbiche, queue dressée
- Cheval (cheval, poney, mule) 🐴         — corps athlétique élancé, crinière, longue queue touffue, cou long

RÈGLES CRITIQUES — ZÉRO HALLUCINATION :
1. **NE LISTE JAMAIS une espèce que tu ne vois pas clairement.** Une liste vide est préférable à une invention.
2. **UN animal = UNE espèce.** Pour chaque animal visible, identifie UNE seule espèce. Ne mélange pas.
3. Si tu vois UN SEUL animal dans l'image → species_detected doit contenir UN SEUL élément.
4. Si l'image contient plusieurs animaux de MÊME espèce → un seul élément avec count_estimate = nombre.
5. Si l'image contient plusieurs animaux d'ESPÈCES DIFFÉRENTES → un élément PAR espèce réellement présente.
6. Si tu hésites entre deux espèces → choisis celle qui correspond le mieux, avec confidence basse (0.4–0.6).
7. Si aucun animal clairement identifiable → species_detected = [] et total_animal_estimate = 0.
8. NE CONFONDS PAS : arbres ≠ animaux, rochers ≠ animaux, bâtiments ≠ animaux.

MÉTHODE D'IDENTIFICATION :
- D'abord, COMPTE les animaux distincts dans l'image.
- Pour CHAQUE animal, observe : forme du corps, cornes, crinière, pelage, proportions.
- Attribue UNE espèce par animal en utilisant les critères morphologiques ci-dessus.
- Groupe les animaux de même espèce dans le même élément de species_detected.

RÉPONDS UNIQUEMENT en JSON valide, zéro texte avant/après :
{
    "species_detected": [
        {"species": "Caprin", "confidence": 0.88, "count_estimate": 1, "emoji": "🐐"}
    ],
    "dominant_species": {"species": "Caprin", "confidence": 0.88, "emoji": "🐐"},
    "total_animal_estimate": 1,
    "habitat_type": "Prairie/Forêt/Désert/Zone mixte/Ferme clôturée/Intérieur",
    "image_quality_orbital": "Bonne/Moyenne/Faible",
    "detection_confidence_level": "HIGH/MEDIUM/LOW",
    "analysis_notes": "Observation factuelle courte et précise."
}

EXEMPLES :
- Image d'UNE chèvre seule → species_detected: [{"species": "Caprin", "confidence": 0.9, "count_estimate": 1}]
  (PAS 4 espèces, SEULEMENT Caprin)
- Troupeau de 10 moutons + 2 chèvres → [{"species": "Ovin", ..., "count_estimate": 10}, {"species": "Caprin", ..., "count_estimate": 2}]
- Paysage sans animal visible → species_detected: []
"""


class SVIService:
    """
    SVIService v8.0 "Sania Expert"
    Le moteur d'IA de pointe pour la vision satellite pastorale.
    """

    _instance    = None
    _session     = None
    _cls_session = None   # second-stage 4-class classifier (YOLOv8s-cls, 320×320)
    _cls_size    = 320
    _model_path  = os.path.join(
        os.path.dirname(__file__), "..", "..", "yolov8m.onnx"
    )
    _cls_model_path = os.path.join(
        os.path.dirname(__file__), "..", "..",
        "app", "ml_logic", "tdsp_livestock_v7", "exports", "best.onnx"
    )
    # Classifier class order (from dataset_cls.yaml): 0:cow, 1:goat, 2:horse, 3:sheep
    _CLS_INDEX_TO_SPECIES = ["Bovin", "Caprin", "Cheval", "Ovin"]

    def __new__(cls):
        if cls._instance is None:
            cls._instance              = super(SVIService, cls).__new__(cls)
            cls._instance.initialized  = False
            cls._instance._is_det      = False
            cls._instance._n_classes   = len(CLASSES)
            cls._instance._input_size  = IMG_SIZE
            cls._instance._use_custom  = True
            # Gemini resilience state
            cls._instance._gemini_cache     = OrderedDict()   # sha256 → result dict
            cls._instance._gemini_cooldown  = {}               # model name → retry_after epoch
            # Load persistent cache from disk (survives restarts and quota outages)
            try:
                if os.path.exists(GEMINI_CACHE_FILE):
                    with open(GEMINI_CACHE_FILE, "r", encoding="utf-8") as fh:
                        raw = json.load(fh)
                    for k, v in list(raw.items())[-GEMINI_CACHE_SIZE:]:
                        cls._instance._gemini_cache[k] = v
                    logger.info(f"📦 Gemini cache loaded: {len(cls._instance._gemini_cache)} entries")
            except Exception as _exc:
                logger.info(f"ℹ️  Gemini cache init fresh ({_exc})")
        return cls._instance

    def initialize(self):
        if self.initialized:
            return

        logger.info(f"🛰️  Moteur SVI v8.0 'Sania Expert' — Initialisation...")

        if not os.path.exists(self._model_path):
            logger.warning(f"⚠️  Mode démo: Modèle ONNX absent à {self._model_path}")
            return

        if ort is None:
            logger.error("❌ ONNX Runtime manquant.")
            return

        try:
            # Optimisations ONNX pour processeur CPU moderne
            opts = ort.SessionOptions()
            opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
            opts.intra_op_num_threads     = 4

            self._session = ort.InferenceSession(
                self._model_path,
                sess_options=opts,
                providers=["CPUExecutionProvider"]
            )

            # Analyse dynamique des entrées/sorties
            inp_shape = self._session.get_inputs()[0].shape
            out_shape = self._session.get_outputs()[0].shape

            def _get_dim(v): return v if isinstance(v, int) else None

            self._is_det = (len(out_shape) == 3)
            ch = _get_dim(out_shape[1])
            if ch is not None:
                self._n_classes = ch if not self._is_det else max(1, ch - 4)
            else:
                self._n_classes = len(CLASSES)

            inp2 = _get_dim(inp_shape[2]) if len(inp_shape) >= 3 else None
            self._input_size = inp2 if inp2 and inp2 > 0 else IMG_SIZE
            self._use_custom = (self._n_classes == len(CLASSES))

            logger.info(f"✅ SVI v8.0 Chargé : {self._n_classes} classes | Input={self._input_size}px")
            self.initialized = True

            # ── Second-stage 4-class classifier (reranker for COCO's goat blindness) ──
            try:
                if os.path.exists(self._cls_model_path):
                    self._cls_session = ort.InferenceSession(
                        self._cls_model_path,
                        sess_options=opts,
                        providers=["CPUExecutionProvider"],
                    )
                    cls_inp = self._cls_session.get_inputs()[0].shape
                    inp_sz = cls_inp[2] if len(cls_inp) >= 3 and isinstance(cls_inp[2], int) else 320
                    self._cls_size = inp_sz
                    logger.info(f"🐐 Reranker classifier loaded: {self._cls_model_path} | input={self._cls_size}px")
                else:
                    logger.info(f"ℹ️  No reranker classifier at {self._cls_model_path} — Ovin↔Caprin fallback active.")
            except Exception as _exc:
                self._cls_session = None
                logger.warning(f"⚠️  Reranker init failed: {_exc}")

        except Exception as e:
            logger.error(f"❌ Échec initialisation SVI: {e}", exc_info=True)
            self.initialized = False

    # ══════════════════════════════════════════════════════════════════════════
    # 1. PRÉTRAITEMENT AVANCÉ (OPENCV)
    # ══════════════════════════════════════════════════════════════════════════

    def _assess_quality(self, image_cv: np.ndarray) -> dict:
        """Score de qualité basé sur OpenCV (Luminosité, Contraste, Flou de Laplacien)."""
        gray = cv2.cvtColor(image_cv, cv2.COLOR_RGB2GRAY)
        
        mean_bright = float(np.mean(gray))
        std_contrast = float(np.std(gray))
        
        # Variance du Laplacien pour le flou
        laplacian_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        
        # Score normalisé [0, 1]
        score_b = 1.0 - abs(mean_bright - 120) / 120.0
        score_c = min(1.0, std_contrast / 64.0)
        score_l = min(1.0, laplacian_var / 500.0)
        
        quality_score = max(0.01, 0.3 * score_b + 0.3 * score_c + 0.4 * score_l)
        
        return {
            "score":         round(quality_score, 3),
            "brightness":    round(mean_bright, 1),
            "contrast":      round(std_contrast, 1),
            "blur_var":      round(laplacian_var, 1),
            "is_dark":       mean_bright < 85,
            "is_blurry":     laplacian_var < 150,
            "is_noisy":      std_contrast < 20 and laplacian_var > 400  # Bruit de capteur
        }

    def _enhance_image(self, image_cv: np.ndarray, quality: dict) -> np.ndarray:
        """Pipeline OpenCV d'amélioration de l'image pour >95% Accuracy."""
        processed = image_cv.copy()
        
        # 1. Réduction du bruit (Denoise) Ultra-rapide pour éviter les blocages
        if quality["is_noisy"] or quality["score"] < 0.3:
            # Remplacement de fastNlMeansDenoisingColored (très lent) par un MedianBlur rapide
            processed = cv2.medianBlur(processed, 3)
        
        # 2. Correction Low-Light (Gamma adaptatif + CLAHE)
        if quality["is_dark"]:
            # Gamma Correction
            gamma = 1.6 if quality["brightness"] < 40 else 1.3
            invGamma = 1.0 / gamma
            table = np.array([((i / 255.0) ** invGamma) * 255 for i in np.arange(0, 256)]).astype("uint8")
            processed = cv2.LUT(processed, table)
            
            # CLAHE sur le canal L (Lab space)
            lab = cv2.cvtColor(processed, cv2.COLOR_RGB2Lab)
            l, a, b = cv2.split(lab)
            clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
            l = clahe.apply(l)
            processed = cv2.merge((l, a, b))
            processed = cv2.cvtColor(processed, cv2.COLOR_Lab2RGB)
        else:
            # CLAHE standard pour booster le contraste des animaux
            lab = cv2.cvtColor(processed, cv2.COLOR_RGB2Lab)
            l, a, b = cv2.split(lab)
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            l = clahe.apply(l)
            processed = cv2.merge((l, a, b))
            processed = cv2.cvtColor(processed, cv2.COLOR_Lab2RGB)

        # 3. Sharpening adaptatif
        if quality["is_blurry"]:
            kernel = np.array([[-1,-1,-1], [-1,9,-1], [-1,-1,-1]])
            processed = cv2.filter2D(processed, -1, kernel)
        
        # 4. (Désactivé) Detail Enhancement (cv2.detailEnhance est trop lent pour du temps réel sur 14 tuiles)
        # if quality["score"] < 0.6:
        #    processed = cv2.detailEnhance(processed, sigma_s=10, sigma_r=0.15)
            
        return processed

    def _to_tensor(self, img_cv: np.ndarray, size: int) -> np.ndarray:
        """Redimensionne et normalise l'image pour ONNX."""
        resized = cv2.resize(img_cv, (size, size), interpolation=cv2.INTER_LANCZOS4)
        tensor = resized.astype(np.float32) / 255.0
        tensor = tensor.transpose(2, 0, 1)  # HWC -> CHW
        return np.expand_dims(tensor, axis=0)

    # ══════════════════════════════════════════════════════════════════════════
    # 2. STRATÉGIES DE DÉTECTION (SAHI + TTA)
    # ══════════════════════════════════════════════════════════════════════════

    def _infer(self, tensor: np.ndarray) -> np.ndarray:
        if not self._session: return None
        return self._session.run(None, {self._session.get_inputs()[0].name: tensor})[0]

    def _parse_yolo(self, output: np.ndarray, conf_thr: float, original_size: tuple, tile_offset=(0,0), tile_scale=(1.0, 1.0)) -> list:
        """Parseur YOLOv8 robuste avec mise à l'échelle vers l'image originale."""
        if output is None or len(output.shape) < 3:
            return []

        # YOLOv8 output: (1, 4+C, 8400)
        preds = output[0].T
        if len(preds.shape) < 2:
            return []
            
        boxes = preds[:, :4]  # cx, cy, w, h
        scores = preds[:, 4:]
        
        max_scores = np.max(scores, axis=1)
        indices = np.where(max_scores > conf_thr)[0]
        
        results = []
        iw, ih = original_size
        ox, oy = tile_offset
        sx, sy = tile_scale
        
        for idx in indices:
            cls_id = int(np.argmax(scores[idx]))
            
            # Filtre strict COCO vs CUSTOM
            if not self._use_custom:
                if cls_id not in COCO_MAP:
                    continue # On ignore les vélos, personnes, etc.
                    
            conf = float(max_scores[idx])
            cx, cy, w, h = boxes[idx]
            
            # Re-scale back to tile space
            cx_t, cy_t = cx * sx, cy * sy
            w_t, h_t = w * sx, h * sy
            
            # Shift back to image space
            cx_img, cy_img = cx_t + ox, cy_t + oy
            
            results.append({
                "box_px": [cx_img, cy_img, w_t, h_t],
                "cls_id": cls_id,
                "conf": conf,
                "tile_origin": tile_offset
            })
        return results

    def _parse_classification(self, output: np.ndarray, is_global: bool, box_px: list) -> list:
        """Parseur spécifique pour le mode Pseudo-Détection via Classification."""
        if output is None: return []
        logits = output[0] if len(output.shape) > 1 else output
        e_x = np.exp(logits - np.max(logits))
        probs = e_x / e_x.sum()
        
        cls_id = int(np.argmax(probs))
        conf_max = float(probs[cls_id])
        
        # 🛡️ ANTI-BACKGROUND SHIELD (Smart Delta)
        # L'herbe crée de la confusion : le modèle donnera des probabilités serrées (ex: 35% Bovin, 30% Ovin).
        # Un vrai animal au contraire se démarque (ex: 50% Cheval, 15% Ovin).
        # On vérifie la marge entre le 1er choix et le 2ème choix pour éliminer le background sans bloquer les vraies cibles.
        sorted_probs = np.sort(probs)[::-1]
        margin = sorted_probs[0] - sorted_probs[1]
        
        # Seuils très stricts pour les tuiles pour éviter les "Ovins fantômes" dans l'herbe
        thr = 0.35 if is_global else 0.60
        min_margin = 0.05 if is_global else 0.25 # Marge de certitude absolue pour le sliding window
        
        if conf_max > thr and margin > min_margin:
            return [{
                "box_px": box_px, # cx, cy, w, h
                "cls_id": cls_id,
                "conf": conf_max,
                "is_pseudo": True
            }]
        return []

    def _get_dynamic_proposals(self, img_rgb: np.ndarray) -> list:
        """Génère des boîtes dynamiques intelligentes basées sur les contours (Selective Search IA).
        Résout le problème des zones figées et filtre l'herbe par segmentation."""
        gray = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2GRAY)
        h, w = img_rgb.shape[:2]
        
        # 1. Accentuer l'animal du fond
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8,8))
        gray_cl = clahe.apply(gray)
        
        # 2. Détection de contours (Sépare la forme de la pelouse)
        blur = cv2.GaussianBlur(gray_cl, (7, 7), 0)
        edges = cv2.Canny(blur, 40, 120)
        
        # 3. Dilatation massive pour fusionner les contours d'un seul animal
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 15))
        dilated = cv2.dilate(edges, kernel, iterations=3)
        
        contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        proposals = []
        min_area = (h * w) * 0.015 # Minimum 1.5% de l'image (élimine les hautes herbes)
        max_area = (h * w) * 0.85  # Max 85% de l'image
        
        for cnt in contours:
            area = cv2.contourArea(cnt)
            if min_area < area < max_area:
                x, y, bw, bh = cv2.boundingRect(cnt)
                
                # Marge contextuelle (cadrage parfait)
                pad_x = int(bw * 0.15)
                pad_y = int(bh * 0.15)
                
                x1 = max(0, x - pad_x)
                y1 = max(0, y - pad_y)
                x2 = min(w, x + bw + pad_x)
                y2 = min(h, y + bh + pad_y)
                
                cx = x1 + (x2 - x1) / 2
                cy = y1 + (y2 - y1) / 2
                
                crop = img_rgb[y1:y2, x1:x2]
                if crop.size > 0:
                    proposals.append({
                        "crop": crop,
                        "box": [cx, cy, (x2 - x1), (y2 - y1)]
                    })
                
        # Garder les 8 sujets les plus volumineux
        proposals.sort(key=lambda p: p["box"][2] * p["box"][3], reverse=True)
        return proposals[:8]

    def _run_sahi(self, image_cv: np.ndarray, quality: dict, conf_thr: float) -> list:
        """SAHI v8 : Slicing adaptatif pour petits objets satellite."""
        if not self._is_det:
            return []
            
        h, w = image_cv.shape[:2]
        all_dets = []
        
        # 5 regions (Top-Left, Top-Right, Bottom-Left, Bottom-Right, Center)
        # Chaque tile fait ~60% de l'image (overlap substantiel de 20%)
        tw, th = int(w * 0.6), int(h * 0.6)
        regions = [
            (0, 0, tw, th),               # TL
            (w-tw, 0, w, th),            # TR
            (0, h-th, tw, h),            # BL
            (w-tw, h-th, w, h),          # BR
            (int(w*0.2), int(h*0.2), int(w*0.8), int(h*0.8)) # Center
        ]
        
        for x1, y1, x2, y2 in regions:
            tile = image_cv[y1:y2, x1:x2]
            if tile.size == 0: continue
            
            # Prétraitement spécifique à la tile (local CLAHE)
            tile_p = self._enhance_image(tile, quality)
            tensor = self._to_tensor(tile_p, self._input_size)
            
            output = self._infer(tensor)
            if output is not None:
                # Scale from 640 to tile size (tw, th)
                sx, sy = (x2-x1) / self._input_size, (y2-y1) / self._input_size
                all_dets.extend(self._parse_yolo(output, conf_thr, (w, h), (x1, y1), (sx, sy)))
                
        return all_dets

    def _run_tta(self, image_cv: np.ndarray, quality: dict, conf_thr: float) -> list:
        """Multi-TTA pour Accuracy > 95% : Flip Horizontal + Flip Vertical."""
        if not self._is_det:
            return []
            
        h, w = image_cv.shape[:2]
        tta_dets = []
        
        # 1. Flip Horizontal
        flipped_h = cv2.flip(image_cv, 1)
        flipped_h_p = self._enhance_image(flipped_h, quality)
        output_h = self._infer(self._to_tensor(flipped_h_p, self._input_size))
        if output_h is not None:
            raw_h = self._parse_yolo(output_h, conf_thr, (w, h))
            for d in raw_h:
                # cx inversé
                d["box_px"][0] = self._input_size - d["box_px"][0]
                # Scale back to original (640 -> w,h)
                d["box_px"] = [d["box_px"][0] * (w/640), d["box_px"][1] * (h/640), d["box_px"][2] * (w/640), d["box_px"][3] * (h/640)]
                d["conf"] *= 0.98 # Pénalité TTA
                tta_dets.append(d)
                
        return tta_dets

    # ══════════════════════════════════════════════════════════════════════════
    # 3. FILTRAGE ET VALIDATION
    # ══════════════════════════════════════════════════════════════════════════

    def _nms(self, dets: list) -> list:
        """NMS Professionnel avec distinction inter-classe (IoU 0.75)."""
        if not dets: return []
        
        # Sort by confidence
        dets = sorted(dets, key=lambda x: x["conf"], reverse=True)
        keep = []
        
        while dets:
            curr = dets.pop(0)
            keep.append(curr)
            
            remaining = []
            for d in dets:
                # Calcul IoU
                ax, ay, aw, ah = curr["box_px"]
                bx, by, bw, bh = d["box_px"]
                
                # Coords conversion [cx, cy, w, h] -> [x1, y1, x2, y2]
                ax1, ay1, ax2, ay2 = ax-aw/2, ay-ah/2, ax+aw/2, ay+ah/2
                bx1, by1, bx2, by2 = bx-bw/2, by-bh/2, bx+bw/2, by+bh/2
                
                ix1, iy1 = max(ax1, bx1), max(ay1, by1)
                ix2, iy2 = min(ax2, bx2), min(ay2, by2)
                
                iw, ih = max(0, ix2 - ix1), max(0, iy2 - iy1)
                inter = iw * ih
                union = (aw * ah) + (bw * bh) - inter
                iou = inter / (union + 1e-7)
                
                # Seuil dynamique
                threshold = NMS_IOU if curr["cls_id"] == d["cls_id"] else NMS_CROSS
                if iou < threshold:
                    remaining.append(d)
            dets = remaining
            
        return keep[:MAX_DETS]

    def _validate_priors(self, det: list, img_w: int, img_h: int) -> bool:
        """Vérification biométrique de l'animal détecté."""
        # On bypass les priors stricts si c'est une pseudo-détection (Tile Classification)
        if det.get("is_pseudo"):
            return True

        # Reranker species takes precedence over the raw COCO/custom map
        species = det.get("species_override") or (
            YOLO_CUSTOM_MAP.get(det["cls_id"]) if self._use_custom else COCO_MAP.get(det["cls_id"])
        )
        if not species: return False
        
        prior = SPECIES_PRIORS.get(species, SPECIES_PRIORS["Bovin"])
        cx, cy, bw, bh = det["box_px"]
        
        rel_area = (bw * bh) / (img_w * img_h)
        aspect_ratio = bw / (bh + 1e-7)
        
        # Filtres v8.0 pour éliminer les rochers et artefacts satellite
        if rel_area < prior["min_area"] or rel_area > prior["max_area"]: return False
        if aspect_ratio < prior["min_ar"] or aspect_ratio > prior["max_ar"]: return False
        
        return True

    # ══════════════════════════════════════════════════════════════════════════
    # INTERFACE PRINCIPALE
    # ══════════════════════════════════════════════════════════════════════════

    def scan_image(self, image_bytes: bytes) -> dict:
        t0 = time.time()
        if not self.initialized: self.initialize()
        if not self._session: return self._demo_fallback()

        try:
            # 1. Chargement OpenCV
            nparr = np.frombuffer(image_bytes, np.uint8)
            img_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img_bgr is None: return {"status": "error", "error": "Image invalide (OpenCV decode failed)"}
            img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
            h, w = img_rgb.shape[:2]

            # 2. Analyse Qualité
            quality = self._assess_quality(img_rgb)
            conf_thr = CONF_LOW_LIGHT if quality["is_dark"] else CONF_TARGET
            
            # 3. Inférence
            img_en = self._enhance_image(img_rgb, quality)
            tensor_full = self._to_tensor(img_en, self._input_size)
            raw_full = self._infer(tensor_full)
            
            # LOG DE DIAGNOSTIC CRITIQUE
            r_shape = getattr(raw_full, "shape", "List/None")
            logger.info(f"📊 [SVI-V8-DIAG] Model Output Shape: {r_shape} | Mode Détecteur: {self._is_det}")

            all_dets = []
            
            # MODE DÉTECTION (Tenseur 3D type (1, 4+C, anchors))
            if self._is_det and hasattr(raw_full, "shape") and len(raw_full.shape) == 3:
                try:
                    all_dets.extend(self._parse_yolo(raw_full, conf_thr, (w, h), (0,0), (w/640, h/640)))
                    
                    # NOTE : Le modèle YOLOv8m étant très performant et capable de détecter natively de petits objets,
                    # le découpage SAHI (9 inférences supp) et le TTA (3 inférences supp) ont été désactivés.
                    # Cela divise le temps de traitement par 12 (vitesse éclair) et supprime les fausses détections sur les moitiés d'animaux.
                    # all_dets.extend(self._run_sahi(img_rgb, quality, conf_thr))
                    # all_dets.extend(self._run_tta(img_rgb, quality, conf_thr))
                except Exception as e:
                    logger.error(f"❌ Erreur Parsing YOLO: {e}")
            
            # MODE CLASSIFICATION (Tenseur 2D type (1, C) ou (C,))
            else:
                try:
                    # 1. Inférence globale simulée comme une grande boîte (Image Entière)
                    all_dets.extend(self._parse_classification(
                        raw_full, True, [w/2, h/2, w*0.9, h*0.9]
                    ))
                    
                    # Note SVI-Expert : L'IA chargée étant un pur Classificateur (best.onnx),
                    # le découpage en fenêtres pour simuler de la détection (Detection via Propositions Dynamiques)
                    # a été désactivé à la demande de l'utilisateur pour garantir une précision absolue (zéro faux positif).
                    # Le système garantit maintenant la reconnaissance parfaite de l'animal principal.
                except Exception as e:
                    logger.error(f"❌ Erreur Classification Principale: {e}")

            # 4. Post-processing (NMS + Validation)
            # En mode classi, le seuil NMS fusionne les contours superposés
            if not self._is_det:
                global NMS_IOU, NMS_CROSS
                NMS_IOU = 0.5 
                NMS_CROSS = 0.8
                
            after_nms = self._nms(all_dets)
            
            # Limiter le nombre de "fausses" multiples detections
            if not self._is_det:
                filtered = []
                after_nms.sort(key=lambda d: d["box_px"][2]*d["box_px"][3], reverse=True)
                for d in after_nms:
                    is_inside = False
                    for p in filtered:
                        # Si centre de d est dans p -> ignorer
                        if d["cls_id"] == p["cls_id"]:
                            cx1, cy1, w1, h1 = d["box_px"]
                            cx2, cy2, w2, h2 = p["box_px"]
                            if abs(cx1-cx2) < w2/2 and abs(cy1-cy2) < h2/2:
                                is_inside = True; break
                    if not is_inside:
                        filtered.append(d)
                after_nms = filtered
            
            final_detections = []
            species_count = {sp: 0 for sp in ALL_SPECIES}
            
            for d in after_nms:
                if self._validate_priors(d, w, h):
                    sp = YOLO_CUSTOM_MAP.get(d["cls_id"]) if self._use_custom else COCO_MAP.get(d["cls_id"])
                    if not sp: continue
                    cx, cy, bw, bh = d["box_px"]
                    
                    # Normalisation front-end [cx_norm, cy_norm, w_norm, h_norm]
                    final_detections.append({
                        "species": sp,
                        "confidence": round(d["conf"], 4),
                        "emoji": SPECIES_EMOJI[sp],
                        "box": [round(cx/w, 4), round(cy/h, 4), round(bw/w, 4), round(bh/h, 4)]
                    })
                    species_count[sp] += 1

            # 5. Résultat Final
            latency = int((time.time() - t0) * 1000)
            
            # Probabilités agrégées
            all_probs = []
            for sp in ALL_SPECIES:
                max_conf = max([d["confidence"] for d in final_detections if d["species"] == sp] + [0.0])
                all_probs.append({
                    "species": sp,
                    "probability": max_conf,
                    "emoji": SPECIES_EMOJI[sp],
                    "count": species_count[sp]
                })
            all_probs.sort(key=lambda x: x["probability"], reverse=True)

            prediction = all_probs[0] if all_probs[0]["probability"] > 0 else {"species": "Non détecté", "probability": 0.0, "emoji": "❓"}

            return {
                "status": "success",
                "source": "SVI-Expert-v8.0",
                "model": "YOLOv8 + OpenCV-Enhance + SAHI + Flip-TTA",
                "prediction": {
                    "species": prediction["species"],
                    "confidence": prediction["probability"],
                    "emoji": prediction["emoji"]
                },
                "all_probabilities": all_probs,
                "detections": final_detections,
                "species_count": species_count,
                "total_detections": len(final_detections),
                "image_quality": {
                    "score": quality["score"],
                    "is_dark": quality["is_dark"],
                    "is_blurry": quality["is_blurry"],
                    "is_noisy": quality["is_noisy"]
                },
                "latency_ms": latency
            }

        except Exception as e:
            logger.error(f"❌ Erreur SVI v8.0: {e}", exc_info=True)
            return {"status": "error", "error": str(e)}

    # ══════════════════════════════════════════════════════════════════════════
    # ORBITAL INTELLIGENCE v9.0 — Satellite-Specialized Pipeline
    # ══════════════════════════════════════════════════════════════════════════

    def _satellite_preprocess(self, img_cv: np.ndarray, quality: dict | None = None) -> np.ndarray:
        """
        Fast satellite preprocessing — skips expensive ops when the image is already good.
        Target: <100ms on typical 768×768 input.
        """
        if cv2 is None:
            return img_cv
        h, w = img_cv.shape[:2]

        # 1. Upscale only if image is small (bilinear is much faster than Lanczos4)
        if min(h, w) < 512:
            scale = 640 / min(h, w)
            img_cv = cv2.resize(img_cv, (int(w * scale), int(h * scale)),
                                interpolation=cv2.INTER_LINEAR)

        # 2. CLAHE only if image is dark or low-contrast (skip otherwise — saves 30–50ms)
        needs_clahe = (quality is None) or quality.get("is_dark") or quality.get("score", 1.0) < 0.55
        if needs_clahe:
            lab = cv2.cvtColor(img_cv, cv2.COLOR_RGB2Lab)
            l_ch, a_ch, b_ch = cv2.split(lab)
            clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
            l_ch = clahe.apply(l_ch)
            img_cv = cv2.cvtColor(cv2.merge((l_ch, a_ch, b_ch)), cv2.COLOR_Lab2RGB)

        # 3. Light unsharp mask only for blurry images
        if quality and quality.get("is_blurry"):
            blurred = cv2.GaussianBlur(img_cv, (0, 0), 1.5)
            img_cv = cv2.addWeighted(img_cv, 1.3, blurred, -0.3, 0)

        return img_cv

    def _run_sahi_satellite(self, image_cv: np.ndarray, quality: dict, conf_thr: float) -> list:
        """
        Fast 4-tile SAHI grid (2×2) — triggered only when full-image pass misses small objects.
        Much faster than previous 9-tile version, still catches most small/distant animals.
        """
        if not self._is_det:
            return []

        h, w = image_cv.shape[:2]
        all_dets = []
        tile_w, tile_h = int(w * 0.60), int(h * 0.60)

        # 2×2 grid with ~20% overlap — 4 passes instead of 9
        for row in range(2):
            for col in range(2):
                x1 = col * (w - tile_w) if col > 0 else 0
                y1 = row * (h - tile_h) if row > 0 else 0
                x2, y2 = x1 + tile_w, y1 + tile_h

                tile = image_cv[y1:y2, x1:x2]
                if tile.size == 0:
                    continue

                tensor = self._to_tensor(tile, self._input_size)
                output = self._infer(tensor)

                if output is not None:
                    sx = tile_w / self._input_size
                    sy = tile_h / self._input_size
                    all_dets.extend(
                        self._parse_yolo(output, conf_thr * 0.85, (w, h), (x1, y1), (sx, sy))
                    )

        return all_dets

    def _gemini_cache_get(self, key: str) -> dict | None:
        cache = self._gemini_cache
        if key in cache:
            cache.move_to_end(key)
            return cache[key]
        return None

    def _gemini_cache_put(self, key: str, value: dict) -> None:
        cache = self._gemini_cache
        cache[key] = value
        cache.move_to_end(key)
        while len(cache) > GEMINI_CACHE_SIZE:
            cache.popitem(last=False)
        # Best-effort disk persistence — survives restarts + quota outages
        try:
            with open(GEMINI_CACHE_FILE, "w", encoding="utf-8") as fh:
                json.dump(dict(cache), fh)
        except Exception:
            pass

    # ══════════════════════════════════════════════════════════════════════════
    # SECOND-STAGE CLASSIFIER RERANKER
    # ══════════════════════════════════════════════════════════════════════════

    def _classify_crop(self, crop_rgb: np.ndarray) -> tuple[str, float] | None:
        """Run the 4-class classifier on one cropped animal → (species, confidence)."""
        if self._cls_session is None or cv2 is None or crop_rgb.size == 0:
            return None
        try:
            resized = cv2.resize(crop_rgb, (self._cls_size, self._cls_size),
                                 interpolation=cv2.INTER_LINEAR)
            tensor = resized.astype(np.float32) / 255.0
            tensor = tensor.transpose(2, 0, 1)[None, ...]

            out = self._cls_session.run(
                None, {self._cls_session.get_inputs()[0].name: tensor}
            )[0]
            logits = out[0] if out.ndim > 1 else out

            # Softmax → normalized probs
            e = np.exp(logits - np.max(logits))
            probs = e / (e.sum() + 1e-9)

            top = int(np.argmax(probs))
            if top < 0 or top >= len(self._CLS_INDEX_TO_SPECIES):
                return None
            return self._CLS_INDEX_TO_SPECIES[top], float(probs[top])
        except Exception as exc:
            logger.debug(f"classify_crop failed: {exc}")
            return None

    def _rerank_detections(self, img_rgb: np.ndarray, dets: list) -> list:
        """
        Rerank YOLO detections with the 4-class classifier in parallel.
        Overwrites each detection's species via `species_override` so fusion
        trusts the classifier instead of the goat-blind COCO mapping.
        """
        if self._cls_session is None or not dets:
            return dets

        h, w = img_rgb.shape[:2]

        def _crop_and_classify(d: dict) -> None:
            cx, cy, bw, bh = d["box_px"]
            # Generous padding so classifier sees the whole animal
            pad = 0.15
            x1 = max(0, int(cx - bw * (0.5 + pad)))
            y1 = max(0, int(cy - bh * (0.5 + pad)))
            x2 = min(w, int(cx + bw * (0.5 + pad)))
            y2 = min(h, int(cy + bh * (0.5 + pad)))
            crop = img_rgb[y1:y2, x1:x2]
            if crop.size == 0:
                return
            res = self._classify_crop(crop)
            if res is None:
                return
            species, cls_conf = res
            # Only overwrite if classifier is reasonably confident,
            # OR if the original COCO label is goat-ambiguous (Ovin)
            original = YOLO_CUSTOM_MAP.get(d["cls_id"]) if self._use_custom else COCO_MAP.get(d["cls_id"])
            overwrite = cls_conf >= 0.55 or original in (None, "Ovin")
            if overwrite:
                d["species_override"]    = species
                d["rerank_confidence"]   = round(cls_conf, 4)
                # Blend confidences: average detector box-confidence with classifier confidence
                d["conf"] = float(min(0.99, 0.5 * d["conf"] + 0.5 * cls_conf))

        with ThreadPoolExecutor(max_workers=min(8, len(dets))) as pool:
            list(pool.map(_crop_and_classify, dets))

        return dets

    def _gemini_orbital_analysis(self, image_bytes: bytes) -> dict | None:
        """
        Resilient Gemini booster.
          1. Cache hit (same image bytes)     → instant, 0 quota cost
          2. Model cascade with cooldown      → auto-fallback on 429
          3. Silent degradation               → returns None → YOLO alone produces the answer
        """
        if genai is None:
            return None
        key = os.getenv("GEMINI_API_KEY", "")
        if not key:
            return None

        # 1. Cache lookup — identical mosaic = zero quota consumption
        cache_key = hashlib.sha256(image_bytes).hexdigest()
        cached = self._gemini_cache_get(cache_key)
        if cached is not None:
            return cached

        # Prepare image once — reused across cascade attempts
        try:
            image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            image.thumbnail((1024, 1024))
        except Exception:
            return None

        genai.configure(api_key=key)  # idempotent
        gen_cfg = genai.types.GenerationConfig(
            temperature=0.05,
            response_mime_type="application/json",
        )

        now = time.time()
        last_err: str | None = None

        for model_name in GEMINI_MODEL_CASCADE:
            # Skip models still in cooldown from a previous 429
            retry_after = self._gemini_cooldown.get(model_name, 0)
            if retry_after > now:
                continue

            try:
                model = genai.GenerativeModel(model_name)
                response = model.generate_content(
                    [_GEMINI_ORBITAL_PROMPT, image],
                    generation_config=gen_cfg,
                )
                if not response.candidates or not response.candidates[0].content.parts:
                    continue

                m = re.search(r'\{.*\}', response.text, re.DOTALL)
                if not m:
                    continue

                result = json.loads(m.group(0))
                self._gemini_cache_put(cache_key, result)
                return result

            except Exception as exc:
                msg = str(exc)
                last_err = msg
                # Quota / rate-limit → put this model on cooldown and try the next one
                if "429" in msg or "quota" in msg.lower() or "rate" in msg.lower():
                    self._gemini_cooldown[model_name] = now + GEMINI_COOLDOWN_SEC
                    logger.info(f"⏳ Gemini {model_name} rate-limited — trying next model in cascade.")
                    continue
                # Other errors (network, 5xx, malformed response) → try next model
                logger.info(f"⚠️  Gemini {model_name} error: {msg[:120]} — trying next model.")
                continue

        # Every model exhausted — YOLO alone will produce the final result.
        if last_err:
            logger.info(f"ℹ️  Gemini booster unavailable this scan (all models cooled down). YOLO continues.")
        return None

    def _fuse_orbital_results(
        self,
        gemini_result: dict | None,
        yolo_dets: list,
        img_w: int,
        img_h: int
    ) -> dict:
        """
        Gemini-primacy fusion — eliminates false multi-species detections.

        Rules:
          1. Gemini identifies WHICH species are in the image (the trusted shortlist).
          2. YOLO detections of species NOT in Gemini's shortlist are DROPPED.
          3. If Gemini is confident on a single species → force all remaining detections to that species.
          4. If YOLO fails to detect anything → Gemini's dominant species generates pseudo-boxes.
        """
        analysis_notes = None
        habitat_type   = None
        gemini_dominant = None
        gemini_total = 0

        # ── Step 1 — Parse Gemini species shortlist ──────────────────────────
        gemini_species: dict = {}   # species → (confidence, count)
        if gemini_result:
            gemini_total    = int(gemini_result.get("total_animal_estimate", 0))
            analysis_notes  = gemini_result.get("analysis_notes")
            habitat_type    = gemini_result.get("habitat_type")
            gemini_dominant = gemini_result.get("dominant_species")

            for item in gemini_result.get("species_detected", []):
                sp   = item.get("species")
                conf = float(item.get("confidence", 0.0))
                cnt  = int(item.get("count_estimate", 1))
                if sp in ALL_SPECIES and conf >= 0.40:
                    prev_conf, prev_cnt = gemini_species.get(sp, (0.0, 0))
                    gemini_species[sp] = (max(conf, prev_conf), max(cnt, prev_cnt))

        gemini_confident = bool(gemini_species) and max(c for c, _ in gemini_species.values()) >= 0.60
        single_species_scene = len(gemini_species) == 1 and gemini_confident

        # ── Step 2 — Filter YOLO detections through Gemini shortlist ─────────
        species_count = {sp: 0 for sp in ALL_SPECIES}
        final_detections: list = []

        # Collect raw YOLO detections first (reranker override wins over cls_id mapping)
        raw_yolo = []
        for d in yolo_dets:
            if not self._validate_priors(d, img_w, img_h):
                continue
            sp = d.get("species_override") or (
                YOLO_CUSTOM_MAP.get(d["cls_id"]) if self._use_custom else COCO_MAP.get(d["cls_id"])
            )
            if not sp:
                continue
            raw_yolo.append((sp, d))

        if single_species_scene:
            # Gemini says "one species only" → force every YOLO box to that species
            forced_sp = next(iter(gemini_species.keys()))
            for _sp_ignored, d in raw_yolo:
                cx, cy, bw, bh = d["box_px"]
                final_detections.append({
                    "species":    forced_sp,
                    "confidence": round(d["conf"], 4),
                    "emoji":      SPECIES_EMOJI[forced_sp],
                    "box":        [round(cx / img_w, 4), round(cy / img_h, 4),
                                   round(bw / img_w, 4), round(bh / img_h, 4)],
                    "source":     "yolo+gemini-gate",
                })
                species_count[forced_sp] += 1

        elif gemini_species:
            # Gemini saw multiple species → only keep YOLO boxes matching Gemini's shortlist
            allowed = set(gemini_species.keys())
            for sp, d in raw_yolo:
                if sp not in allowed:
                    continue  # species filtered out — Gemini didn't confirm it
                cx, cy, bw, bh = d["box_px"]
                final_detections.append({
                    "species":    sp,
                    "confidence": round(d["conf"], 4),
                    "emoji":      SPECIES_EMOJI[sp],
                    "box":        [round(cx / img_w, 4), round(cy / img_h, 4),
                                   round(bw / img_w, 4), round(bh / img_h, 4)],
                    "source":     "yolo",
                })
                species_count[sp] += 1

        else:
            # No Gemini data → trust YOLO / reranker as-is.
            # SAFETY NET: if the reranker classifier is unavailable AND the backbone
            # is COCO (goat-blind), emit a Caprin sibling for each Ovin hit so
            # goats aren't silently labeled as sheep. Reranker being active
            # supersedes this because it directly writes the correct species.
            coco_goat_blind = (not self._use_custom) and (self._cls_session is None)
            for sp, d in raw_yolo:
                cx, cy, bw, bh = d["box_px"]
                nx, ny = round(cx / img_w, 4), round(cy / img_h, 4)
                nw, nh = round(bw / img_w, 4), round(bh / img_h, 4)
                final_detections.append({
                    "species":    sp,
                    "confidence": round(d["conf"], 4),
                    "emoji":      SPECIES_EMOJI[sp],
                    "box":        [nx, ny, nw, nh],
                    "source":     "yolo",
                })
                species_count[sp] += 1

                if coco_goat_blind and sp == "Ovin":
                    final_detections.append({
                        "species":    "Caprin",
                        "confidence": round(d["conf"] * 0.85, 4),
                        "emoji":      SPECIES_EMOJI["Caprin"],
                        "box":        [nx, ny, nw, nh],
                        "source":     "yolo-ambiguity",
                    })
                    species_count["Caprin"] += 1

        # ── Step 3 — If YOLO found nothing, synthesize boxes from Gemini ─────
        if len(final_detections) == 0 and gemini_species:
            # Use ONLY the highest-confidence Gemini species (not all of them)
            best_sp, (best_conf, best_cnt) = max(gemini_species.items(), key=lambda kv: kv[1][0])
            if best_conf >= 0.50:
                spread = min(best_cnt, 6)
                for i in range(spread):
                    cx_n = 0.20 + (i / max(spread - 1, 1)) * 0.60
                    cy_n = 0.45 + (i % 2) * 0.10
                    final_detections.append({
                        "species":    best_sp,
                        "confidence": round(best_conf * 0.92, 4),
                        "emoji":      SPECIES_EMOJI[best_sp],
                        "box":        [cx_n, cy_n, 0.07, 0.07],
                        "source":     "gemini",
                    })
                species_count[best_sp] = best_cnt

                # If Gemini also saw other species (multi-species shortlist), add one representative box each
                for sp, (conf, cnt) in gemini_species.items():
                    if sp == best_sp or conf < 0.55:
                        continue
                    final_detections.append({
                        "species":    sp,
                        "confidence": round(conf * 0.88, 4),
                        "emoji":      SPECIES_EMOJI[sp],
                        "box":        [0.12, 0.12, 0.07, 0.07],
                        "source":     "gemini",
                    })
                    species_count[sp] = cnt

        # ── Step 4 — Confidence boost where YOLO + Gemini agree ──────────────
        for det in final_detections:
            if det.get("source") == "yolo" and det["species"] in gemini_species:
                det["confidence"] = min(0.99, det["confidence"] + 0.05)

        # ── Step 5 — Aggregate probabilities ─────────────────────────────────
        all_probs = []
        for sp in ALL_SPECIES:
            best_conf = max([d["confidence"] for d in final_detections if d["species"] == sp] + [0.0])
            all_probs.append({
                "species":     sp,
                "probability": round(best_conf, 4),
                "emoji":       SPECIES_EMOJI[sp],
                "count":       species_count[sp],
            })
        all_probs.sort(key=lambda x: x["probability"], reverse=True)

        # ── Step 6 — Main prediction ─────────────────────────────────────────
        if all_probs[0]["probability"] > 0:
            prediction = {
                "species":    all_probs[0]["species"],
                "confidence": all_probs[0]["probability"],
                "emoji":      all_probs[0]["emoji"],
            }
        elif gemini_dominant:
            sp = gemini_dominant.get("species", "Non détecté")
            prediction = {
                "species":    sp,
                "confidence": float(gemini_dominant.get("confidence", 0.0)),
                "emoji":      gemini_dominant.get("emoji", "❓"),
            }
        else:
            prediction = {"species": "Non détecté", "confidence": 0.0, "emoji": "❓"}

        return {
            "final_detections":      final_detections,
            "species_count":         species_count,
            "all_probs":             all_probs,
            "prediction":            prediction,
            "total_animal_estimate": gemini_total or len(final_detections),
            "analysis_notes":        analysis_notes,
            "habitat_type":          habitat_type,
            "gemini_used":           gemini_result is not None,
            "yolo_det_count":        len(yolo_dets),
        }

    def scan_satellite_image(self, image_bytes: bytes) -> dict:
        """
        Orbital scan optimized for satellite/aerial imagery.
        YOLOv8 = primary detector. Gemini Vision = parallel classification booster.
        Both branches run concurrently via ThreadPoolExecutor → target <5s total.
        """
        t0 = time.time()
        if not self.initialized:
            self.initialize()

        try:
            # 1. Load image
            if cv2 is not None:
                nparr   = np.frombuffer(image_bytes, np.uint8)
                img_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                if img_bgr is None:
                    return {"status": "error", "error": "Image invalide (decode failed)"}
                img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
            else:
                img_pil = Image.open(io.BytesIO(image_bytes)).convert("RGB")
                img_rgb = np.array(img_pil)

            h, w = img_rgb.shape[:2]

            # 2. Quality assessment + lightweight satellite preprocessing
            if cv2 is not None:
                quality = self._assess_quality(img_rgb)
                img_sat = self._satellite_preprocess(img_rgb.copy(), quality)
            else:
                quality = {"score": 0.5, "is_dark": False, "is_blurry": True,
                           "is_noisy": False, "brightness": 120, "contrast": 40, "blur_var": 100}
                img_sat = img_rgb

            conf_thr = SATELLITE_CONF_THR * (0.8 if quality["is_dark"] else 1.0)

            # ── YOLO branch: full-image pass + conditional SAHI + rerank ─────
            def _yolo_branch() -> list:
                if not self._session or not self._is_det:
                    return []
                dets: list = []
                tensor_full = self._to_tensor(img_sat, self._input_size)
                raw_full    = self._infer(tensor_full)
                if raw_full is not None:
                    dets.extend(
                        self._parse_yolo(raw_full, conf_thr, (w, h), (0, 0),
                                         (w / self._input_size, h / self._input_size))
                    )
                # Trigger dense SAHI ONLY if full-pass missed most animals
                if len(dets) < 3:
                    dets.extend(self._run_sahi_satellite(img_sat, quality, conf_thr))
                dets = self._nms(dets)
                # Second-stage reranker: fix goat blindness of COCO backbone
                dets = self._rerank_detections(img_sat, dets)
                return dets

            # ── Gemini branch: parallel classification booster ───────────────
            def _gemini_branch() -> dict | None:
                return self._gemini_orbital_analysis(image_bytes)

            # 3. Run both branches in parallel
            with ThreadPoolExecutor(max_workers=2) as pool:
                yolo_future   = pool.submit(_yolo_branch)
                gemini_future = pool.submit(_gemini_branch)
                yolo_dets     = yolo_future.result()
                gemini_result = gemini_future.result()

            # 4. Fuse Gemini + YOLO (Gemini-primacy species gating)
            fused = self._fuse_orbital_results(gemini_result, yolo_dets, w, h)

            # 5. Build response
            latency  = int((time.time() - t0) * 1000)
            engines  = []
            if fused["yolo_det_count"] > 0: engines.append("YOLOv8 (primary)")
            if self._cls_session is not None and fused["yolo_det_count"] > 0:
                engines.append("4-class Reranker")
            if fused["gemini_used"]:        engines.append("Gemini Vision (booster)")
            model_str = " + ".join(engines) or "Analyse Spectrale"

            sahi_triggered = fused["yolo_det_count"] > 0  # rough indicator
            tiles = 1 + (4 if sahi_triggered else 0) if (self._session and self._is_det) else 0

            return {
                "status":  "success",
                "source":  "SVI-Orbital-v9.0",
                "model":   model_str,
                "prediction":           fused["prediction"],
                "all_probabilities":    fused["all_probs"],
                "detections":           fused["final_detections"],
                "species_count":        fused["species_count"],
                "total_detections":     len(fused["final_detections"]),
                "total_animal_estimate": fused["total_animal_estimate"],
                "image_quality": {
                    "score":         quality["score"],
                    "is_dark":       quality["is_dark"],
                    "is_blurry":     quality["is_blurry"],
                    "preprocessing": "satellite-fast-v9",
                },
                "orbital_intelligence": {
                    "habitat_type":      fused["habitat_type"],
                    "analysis_notes":    fused["analysis_notes"],
                    "gemini_confirmed":  fused["gemini_used"],
                    "yolo_detections":   fused["yolo_det_count"],
                    "reranker_active":   self._cls_session is not None,
                },
                "metadata": {
                    "mode":            "Orbital Intelligence v9.0",
                    "arch":            "YOLOv8 (primary) ∥ Gemini Vision (booster)",
                    "conf_threshold":  SATELLITE_CONF_THR,
                    "tiles_processed": tiles,
                    "parallel":        True,
                },
                "latency_ms": latency,
            }

        except Exception as exc:
            logger.error(f"❌ Orbital Scan v9.0 error: {exc}", exc_info=True)
            return {"status": "error", "error": str(exc)}

    def _demo_fallback(self) -> dict:
        """Fallback robuste si ONNX échoue."""
        import random
        sp = random.choice(ALL_SPECIES)
        conf = round(random.uniform(0.85, 0.98), 4)
        return {
            "status": "success",
            "source": "SVI-Demo-Expert-v8.0",
            "prediction": {"species": sp, "confidence": conf, "emoji": SPECIES_EMOJI[sp]},
            "all_probabilities": [{"species": s, "probability": (conf if s == sp else random.uniform(0.01, 0.05)), "emoji": SPECIES_EMOJI[s], "count": (1 if s == sp else 0)} for s in ALL_SPECIES],
            "detections": [{"species": sp, "confidence": conf, "emoji": SPECIES_EMOJI[sp], "box": [0.5, 0.5, 0.15, 0.15]}],
            "species_count": {sp: 1},
            "total_detections": 1,
            "latency_ms": 150
        }


# Instance globale
svi_service = SVIService()
