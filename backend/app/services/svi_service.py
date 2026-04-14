"""
SVI Service — Moteur de Classification d'Espèces Animales
==========================================================
Architecture : EfficientNet-B0 + Base Head (LayerNorm/GELU)
Pipeline     : Image → Resize 224×224 → Normalize ImageNet → ONNX Inference → Softmax
Classes      : ['Bovin', 'Ovin', 'Caprin', 'Cheval']
Modèle       : svi_farm_ready.onnx (Stable Baseline)
"""

import numpy as np
from PIL import Image, ImageEnhance
import io
import os
import time
import logging

try:
    import onnxruntime as ort
except ImportError:
    ort = None

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ── Constantes du pipeline (identiques au modèle B0)
IMG_SIZE = 224
IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD  = np.array([0.229, 0.224, 0.225], dtype=np.float32)

CLASSES = ['Bovin', 'Ovin', 'Caprin', 'Cheval']
SPECIES_EMOJI = {'Bovin': '🐄', 'Ovin': '🐑', 'Caprin': '🐐', 'Cheval': '🐴'}
ID2LABEL = {i: c for i, c in enumerate(CLASSES)}


class SVIService:
    """
    Service singleton pour l'inférence de classification d'espèces animales.
    Utilise un modèle ONNX EfficientNet-B0 fine-tuné.
    """
    _instance = None
    _session = None
    _model_path = os.path.join(
        os.path.dirname(__file__), "..", "ml_logic", "notebooks", "svi_farm_ready.onnx"
    )

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(SVIService, cls).__new__(cls)
            cls._instance.initialized = False
        return cls._instance

    def initialize(self):
        """Initialise le moteur ONNX Runtime avec le modèle."""
        if self.initialized:
            return

        logger.info(f"📡 SVI Engine: Checking for Model at {self._model_path}")

        if os.path.exists(self._model_path) and ort:
            try:
                self._session = ort.InferenceSession(
                    self._model_path,
                    providers=['CPUExecutionProvider']
                )

                # Vérifier la structure du modèle
                inp = self._session.get_inputs()[0]
                out = self._session.get_outputs()[0]
                model_size = os.path.getsize(self._model_path) / 1e6

                logger.info(f"✅ SVI Engine: ONNX Model Loaded")
                logger.info(f"   Input  : {inp.name} {inp.shape}")
                logger.info(f"   Output : {out.name} {out.shape}")
                logger.info(f"   Size   : {model_size:.1f} MB")
                logger.info(f"   Classes: {CLASSES}")

                self.initialized = True

            except Exception as e:
                logger.error(f"❌ SVI Engine: ONNX Loading Failed: {e}")
                self.initialized = False
        else:
            if not os.path.exists(self._model_path):
                logger.warning(f"📡 SVI Engine: Model not found at {self._model_path}")
                logger.warning("   Run: python backend/scripts/export_onnx_v5.py")
            if not ort:
                logger.warning("📡 SVI Engine: onnxruntime not installed")
            self.initialized = False

    def _preprocess(self, image: Image.Image, expected_size=224, is_yolo=False) -> np.ndarray:
        """Prétraitement dynamique pour EfficientNet ou YOLO avec Filtre Optique Spatial."""
        # --- ENHANCEMENT PIPELINE (LOW QUALITY IMAGES) ---
        # 1. Contrast Auto-Correction
        enhancer_contrast = ImageEnhance.Contrast(image)
        image = enhancer_contrast.enhance(1.4) 
        
        # 2. Sharpness (Anti-blur for foggy weather/satellites)
        enhancer_sharp = ImageEnhance.Sharpness(image)
        image = enhancer_sharp.enhance(1.5) 
        # -------------------------------------------------
        
        img_resized = image.convert("RGB").resize((expected_size, expected_size), Image.BILINEAR)
        img_np = np.array(img_resized, dtype=np.float32) / 255.0

        if not is_yolo:
            # Normalisation ImageNet canal par canal pour EfficientNet
            img_np = (img_np - IMAGENET_MEAN) / IMAGENET_STD

        # HWC → CHW → BCHW
        img_np = img_np.transpose(2, 0, 1)
        return np.expand_dims(img_np, 0).astype(np.float32)

    def _softmax(self, logits: np.ndarray) -> np.ndarray:
        """Softmax numérique stable."""
        e = np.exp(logits - np.max(logits))
        return e / e.sum()

    def _nms(self, boxes: np.ndarray, scores: np.ndarray, classes: np.ndarray, iou_threshold: float = 0.45) -> tuple:
        """
        Suppression des Non-Maxima (NMS) : 
        Nettoie les centaines de carrés qui se chevauchent sur la même vache.
        """
        if len(boxes) == 0:
            return boxes, classes, scores

        # Conversion format YOLO [cx, cy, w, h] vers standard [x1, y1, x2, y2]
        x1 = boxes[:, 0] - boxes[:, 2] / 2
        y1 = boxes[:, 1] - boxes[:, 3] / 2
        x2 = boxes[:, 0] + boxes[:, 2] / 2
        y2 = boxes[:, 1] + boxes[:, 3] / 2

        areas = (x2 - x1) * (y2 - y1)
        order = scores.argsort()[::-1] # Trier par confiance décroissante

        keep = []
        while order.size > 0:
            i = order[0]
            keep.append(i)
            
            xx1 = np.maximum(x1[i], x1[order[1:]])
            yy1 = np.maximum(y1[i], y1[order[1:]])
            xx2 = np.minimum(x2[i], x2[order[1:]])
            yy2 = np.minimum(y2[i], y2[order[1:]])

            w = np.maximum(0.0, xx2 - xx1)
            h = np.maximum(0.0, yy2 - yy1)
            inter = w * h
            
            ovr = inter / (areas[i] + areas[order[1:]] - inter)
            
            # Ne garder que ceux dont le taux de chevauchement est sous le seuil OU de classe différente
            inds = np.where((ovr <= iou_threshold) | (classes[order[1:]] != classes[i]))[0]
            order = order[inds + 1]

        return boxes[keep], classes[keep], scores[keep]

    def scan_image(self, image_bytes: bytes) -> dict:
        """
        Pipeline complet de classification d'espèce animale.
        
        Input  : bytes d'une image (JPEG/PNG)
        Output : dict avec prédiction, probabilités, et métadonnées
        """
        start_time = time.time()

        if not self.initialized:
            self.initialize()

        if not self._session:
            return self._demo_fallback()

        try:
            # 1. Charger l'image
            image = Image.open(io.BytesIO(image_bytes))
            original_size = image.size

            # 2. Détection dynamique de l'architecture ONNX
            input_info = self._session.get_inputs()[0]
            output_info = self._session.get_outputs()[0]
            
            input_name = input_info.name
            
            # shape: ['batch', 3, 640, 640] ou [1, 3, 224, 224]
            in_shape = input_info.shape
            expected_size = in_shape[2] if (len(in_shape) == 4 and isinstance(in_shape[2], int)) else 640
            
            out_shape_info = output_info.shape
            is_yolo = len(out_shape_info) == 3

            # 3. Prétraitement & Inférence
            pixel_values = self._preprocess(image, expected_size=expected_size, is_yolo=is_yolo)
            outputs = self._session.run(None, {input_name: pixel_values})

            detections = []
            out_shape = outputs[0].shape

            if len(out_shape) == 3:
                # YOLO DETECTION PIPELINE (FORMAT FUTUR: 1, 4+classes, anchors)
                preds = outputs[0][0].transpose()
                boxes, scores = preds[:, :4], preds[:, 4:]
                class_ids = np.argmax(scores, axis=1)
                confidences = np.max(scores, axis=1)
                
                valid = confidences > 0.4
                v_boxes, v_classes, v_conf = boxes[valid], class_ids[valid], confidences[valid]
                
                # --- ÉTAPE CRUCIALE --- 
                # NMS algorithme pour supprimer les boîtes superposées sur le même bloc
                v_boxes, v_classes, v_conf = self._nms(v_boxes, v_conf, v_classes, iou_threshold=0.45)
                
                coco_map = {16: "Cheval", 17: "Cheval", 18: "Ovin", 19: "Bovin", 20: "Bovin"} # COCO indices
                n_added = 0
                for i in range(len(v_boxes)):
                    if n_added >= 10: break
                    bx, by, bw, bh = v_boxes[i]
                    
                    if scores.shape[1] > 10: # Modèle COCO standard YOLO
                        if int(v_classes[i]) not in coco_map:
                            continue
                        cls_name = coco_map[int(v_classes[i])]
                    else:
                        cls_name = ID2LABEL.get(v_classes[i], "Bovin")
                        
                    detections.append({
                        "species": cls_name,
                        "confidence": float(v_conf[i]),
                        "emoji": SPECIES_EMOJI.get(cls_name, "🐾"),
                        "box": [float(bx/640), float(by/640), float(bw/640), float(bh/640)] # YOLO normalisé
                    })
                    n_added += 1
                    
                if detections:
                    best_det = max(detections, key=lambda x: x["confidence"])
                    pred_species, pred_confidence = best_det["species"], best_det["confidence"]
                    pred_idx = CLASSES.index(pred_species) if pred_species in CLASSES else 0
                else:
                    pred_species, pred_confidence, pred_idx = "Aucun", 0.0, 0
                probabilities = np.zeros(len(CLASSES))
                probabilities[pred_idx] = pred_confidence
            else:
                # EFFICIENTNET CLASSIFICATION (ACTUEL)
                logits = outputs[0][0]
                probabilities = self._softmax(logits)

                pred_idx = int(np.argmax(probabilities))
                pred_confidence = float(probabilities[pred_idx])
                pred_species = ID2LABEL[pred_idx]
                
                # Simulation de Bounding Box en attendant YOLO
                detections.append({
                    "species": pred_species,
                    "confidence": pred_confidence,
                    "emoji": SPECIES_EMOJI.get(pred_species, "🐾"),
                    "box": [0.5, 0.5, 0.5, 0.7] # [centre X, centre Y, largeur, hauteur] 
                })

            # Toutes les probabilités par classe (triées par confiance)
            all_probs = []
            for i, cls_name in enumerate(CLASSES):
                all_probs.append({
                    "species": cls_name,
                    "label_id": i,
                    "probability": float(round(probabilities[i], 4)),
                    "emoji": SPECIES_EMOJI.get(cls_name, "🐾")
                })
            all_probs.sort(key=lambda x: x['probability'], reverse=True)

            latency_ms = int((time.time() - start_time) * 1000)

            return {
                "status": "success",
                "source": "SVI-EfficientNet-v5-Stable",
                "model": "EfficientNet-B0 (ONNX)",
                "prediction": {
                    "species": pred_species,
                    "confidence": float(round(pred_confidence, 4)),
                    "label_id": pred_idx,
                    "emoji": SPECIES_EMOJI.get(pred_species, "🐾")
                },
                "all_probabilities": all_probs,
                "detections": detections,
                "metadata": {
                    "input_size": f"{IMG_SIZE}×{IMG_SIZE}",
                    "original_size": f"{original_size[0]}×{original_size[1]}",
                    "classes": len(CLASSES),
                    "normalization": "ImageNet"
                },
                "latency_ms": latency_ms
            }

        except Exception as e:
            logger.error(f"❌ SVI Scan Error: {e}", exc_info=True)
            return {
                "status": "error",
                "error": str(e),
                "prediction": None,
                "all_probabilities": []
            }

    def _demo_fallback(self) -> dict:
        """Retourne un résultat de démonstration quand le modèle n'est pas disponible."""
        import random
        
        # Simuler une classification réaliste pour la démo
        probs = np.random.dirichlet([8, 2, 1, 1])
        probs = np.sort(probs)[::-1]  # trier décroissant
        
        # Mélanger les classes
        indices = list(range(len(CLASSES)))
        random.shuffle(indices)
        
        pred_idx = indices[0]
        
        all_probs = []
        for rank, i in enumerate(indices):
            all_probs.append({
                "species": CLASSES[i],
                "label_id": i,
                "probability": float(round(probs[rank], 4)),
                "emoji": SPECIES_EMOJI.get(CLASSES[i], "🐾")
            })
        all_probs.sort(key=lambda x: x['probability'], reverse=True)
        
        return {
            "status": "success",
            "source": "SVI-Demo-Fallback",
            "model": "Simulation (modèle ONNX non chargé)",
            "prediction": {
                "species": all_probs[0]["species"],
                "confidence": all_probs[0]["probability"],
                "label_id": all_probs[0]["label_id"],
                "emoji": all_probs[0]["emoji"]
            },
            "all_probabilities": all_probs,
            "detections": [{
                "species": all_probs[0]["species"],
                "confidence": all_probs[0]["probability"],
                "emoji": all_probs[0]["emoji"],
                "box": [0.5, 0.5, 0.5, 0.6]
            }],
            "metadata": {
                "input_size": f"{IMG_SIZE}×{IMG_SIZE}",
                "original_size": "N/A",
                "classes": len(CLASSES),
                "normalization": "ImageNet"
            },
            "message": "⚠️ Mode démonstration — Exécutez export_onnx_v5.py pour activer le moteur réel.",
            "latency_ms": 42
        }


# Global singleton instance
svi_service = SVIService()
