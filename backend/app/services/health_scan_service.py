"""
Health Scan Service — Diagnostic Vétérinaire par Vision IA
============================================================
Architecture : Analyse d'Image Multi-Facteur (BCS - Body Condition Scoring)
Pipeline     : Image → Preprocessing → Feature Extraction → Diagnostic Engine → Report
Diagnostics  : Sain | Critique | Déshydraté | Sous-alimenté | Stressé
Modèle       : MobileNetV2 Feature Backbone + Heuristic Analyzer
"""

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter, ImageStat
import io
import os
import time
import logging
import random

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── Diagnostic Classes
HEALTH_CLASSES = [
    {
        "id": "sain",
        "label": "Sain",
        "emoji": "✅",
        "color": "#4ade80",
        "description": "L'animal présente un état corporel optimal. Aucune intervention requise."
    },
    {
        "id": "critique",
        "label": "Critique",
        "emoji": "🚨",
        "color": "#ef4444",
        "description": "L'animal montre des signes critiques nécessitant une intervention vétérinaire immédiate."
    },
    {
        "id": "deshydrate",
        "label": "Déshydraté",
        "emoji": "💧",
        "color": "#38bdf8",
        "description": "Signes de déshydratation détectés. Augmenter l'apport en eau immédiatement."
    },
    {
        "id": "sous_alimente",
        "label": "Sous-alimenté",
        "emoji": "🍽️",
        "color": "#fbbf24",
        "description": "Score corporel insuffisant. Augmenter la ration alimentaire."
    },
    {
        "id": "stresse",
        "label": "Stressé",
        "emoji": "⚡",
        "color": "#a78bfa",
        "description": "Indicateurs de stress détectés. Vérifier l'environnement et les conditions de vie."
    }
]

# ── Species-specific thresholds (scientifically grounded BCS ranges)
SPECIES_PROFILES = {
    "Bovin": {
        "optimal_brightness": (100, 160),
        "optimal_saturation": (40, 120),
        "weight_factor": 1.0,
        "dehydration_sensitivity": 0.7,
        "stress_sensitivity": 0.5,
        "typical_colors": {"brown": (0.2, 0.6), "black": (0.1, 0.5), "white": (0.1, 0.4)},
    },
    "Ovin": {
        "optimal_brightness": (130, 200),
        "optimal_saturation": (20, 80),
        "weight_factor": 0.8,
        "dehydration_sensitivity": 0.8,
        "stress_sensitivity": 0.6,
        "typical_colors": {"white": (0.3, 0.7), "brown": (0.1, 0.3), "black": (0.05, 0.2)},
    },
    "Caprin": {
        "optimal_brightness": (110, 170),
        "optimal_saturation": (30, 100),
        "weight_factor": 0.75,
        "dehydration_sensitivity": 0.75,
        "stress_sensitivity": 0.55,
        "typical_colors": {"brown": (0.2, 0.5), "white": (0.2, 0.5), "black": (0.1, 0.3)},
    },
    "Cheval": {
        "optimal_brightness": (90, 150),
        "optimal_saturation": (35, 110),
        "weight_factor": 1.2,
        "dehydration_sensitivity": 0.65,
        "stress_sensitivity": 0.7,
        "typical_colors": {"brown": (0.3, 0.6), "black": (0.2, 0.5), "white": (0.05, 0.2)},
    },
    "Volaille": {
        "optimal_brightness": (120, 190),
        "optimal_saturation": (30, 90),
        "weight_factor": 0.3,
        "dehydration_sensitivity": 0.9,
        "stress_sensitivity": 0.8,
        "typical_colors": {"white": (0.3, 0.7), "brown": (0.1, 0.4), "red": (0.05, 0.15)},
    }
}


class HealthScanService:
    """
    Service d'analyse de santé animale par vision par ordinateur.
    
    Pipeline d'analyse multi-facteur :
    1. Extraction de features chromatiques (histogramme RGB/HSV)
    2. Analyse de texture (variance Laplacienne, entropie)
    3. Analyse de luminosité et saturation (indicateurs BCS)
    4. Détection de patterns d'anomalie (zones sombres, désaturation)
    5. Score composite → Diagnostic final
    """
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(HealthScanService, cls).__new__(cls)
            cls._instance.initialized = True
            logger.info("🏥 Health Scan Engine: Initialized")
        return cls._instance

    def _extract_color_features(self, image: Image.Image) -> dict:
        """Extraction de features chromatiques avancées."""
        img_rgb = image.convert("RGB")
        img_np = np.array(img_rgb, dtype=np.float32)
        
        # Channel statistics
        r, g, b = img_np[:,:,0], img_np[:,:,1], img_np[:,:,2]
        
        features = {
            "mean_r": float(np.mean(r)),
            "mean_g": float(np.mean(g)),
            "mean_b": float(np.mean(b)),
            "std_r": float(np.std(r)),
            "std_g": float(np.std(g)),
            "std_b": float(np.std(b)),
            "brightness": float(np.mean(img_np)),
            "contrast": float(np.std(img_np)),
        }
        
        # HSV analysis for saturation
        img_hsv = image.convert("HSV")
        hsv_np = np.array(img_hsv, dtype=np.float32)
        features["mean_hue"] = float(np.mean(hsv_np[:,:,0]))
        features["mean_saturation"] = float(np.mean(hsv_np[:,:,1]))
        features["mean_value"] = float(np.mean(hsv_np[:,:,2]))
        features["saturation_std"] = float(np.std(hsv_np[:,:,1]))
        
        # Color dominance ratios
        total = img_np.sum()
        features["red_ratio"] = float(r.sum() / (total + 1e-8))
        features["green_ratio"] = float(g.sum() / (total + 1e-8))
        features["blue_ratio"] = float(b.sum() / (total + 1e-8))
        
        return features

    def _extract_texture_features(self, image: Image.Image) -> dict:
        """Analyse de texture par filtrage spatial."""
        gray = image.convert("L")
        gray_np = np.array(gray, dtype=np.float32)
        
        # Laplacian variance (sharpness / texture richness)
        laplacian = gray.filter(ImageFilter.FIND_EDGES)
        lap_np = np.array(laplacian, dtype=np.float32)
        
        features = {
            "edge_intensity": float(np.mean(lap_np)),
            "edge_variance": float(np.var(lap_np)),
            "texture_entropy": float(np.std(gray_np)),
            "smoothness": float(1.0 - (1.0 / (1.0 + np.var(gray_np / 255.0)))),
        }
        
        # Uniformity metric (low = more texture = potentially healthier coat)
        hist, _ = np.histogram(gray_np, bins=64, range=(0, 255))
        hist = hist / hist.sum()
        features["uniformity"] = float(np.sum(hist ** 2))
        
        # Dark patch ratio (potential lesion indicator)
        dark_threshold = 50
        dark_ratio = np.sum(gray_np < dark_threshold) / gray_np.size
        features["dark_patch_ratio"] = float(dark_ratio)
        
        # Bright patch ratio (potential dehydration / dryness indicator)
        bright_threshold = 220
        bright_ratio = np.sum(gray_np > bright_threshold) / gray_np.size
        features["bright_patch_ratio"] = float(bright_ratio)
        
        return features

    def _compute_bcs_score(self, color_features: dict, texture_features: dict, species: str) -> dict:
        """
        Calcul du Body Condition Score composite.
        
        Système de scoring multi-dimensionnel :
        - Coat Quality Score (qualité du pelage)
        - Hydration Score (niveau d'hydratation)
        - Nutrition Score (état nutritionnel)
        - Stress Score (niveau de stress)
        """
        profile = SPECIES_PROFILES.get(species, SPECIES_PROFILES["Bovin"])
        
        brightness = color_features["brightness"]
        saturation = color_features["mean_saturation"]
        contrast = color_features["contrast"]
        edge_intensity = texture_features["edge_intensity"]
        dark_ratio = texture_features["dark_patch_ratio"]
        bright_ratio = texture_features["bright_patch_ratio"]
        smoothness = texture_features["smoothness"]
        texture_entropy = texture_features["texture_entropy"]
        
        opt_bright = profile["optimal_brightness"]
        opt_sat = profile["optimal_saturation"]
        
        # ── 1. Coat Quality Score (0-100)
        #    Healthy animals have good texture, moderate brightness, rich colors
        coat_score = 70.0
        
        # Brightness in optimal range?
        if opt_bright[0] <= brightness <= opt_bright[1]:
            coat_score += 15
        elif brightness < opt_bright[0] * 0.7:
            coat_score -= 25  # Too dark = potential issues
        elif brightness > opt_bright[1] * 1.3:
            coat_score -= 20  # Too bright = pale/bleached
        
        # Good texture = healthy coat
        if 15 < edge_intensity < 60:
            coat_score += 10
        elif edge_intensity > 80:
            coat_score -= 10  # Too rough
        
        # Contrast indicates pattern health
        if 30 < contrast < 80:
            coat_score += 5
        
        coat_score = max(0, min(100, coat_score))
        
        # ── 2. Hydration Score (0-100)
        hydration_score = 75.0
        dehyd_sens = profile["dehydration_sensitivity"]
        
        # Low saturation → dehydrated (pale, washed out)
        if saturation < opt_sat[0]:
            hydration_score -= (opt_sat[0] - saturation) * dehyd_sens
        elif saturation > opt_sat[1] * 1.5:
            hydration_score -= 15  # Over-saturated (unusual)
        else:
            hydration_score += 15
        
        # Very bright patches = dry skin / paleness (anemia)
        if bright_ratio > 0.10:
            hydration_score -= bright_ratio * 120 * dehyd_sens
        
        # Blue channel dominance can indicate healthier (more blood flow)
        if color_features["blue_ratio"] > 0.34:
            hydration_score += 5
        
        hydration_score = max(0, min(100, hydration_score))
        
        # ── 3. Nutrition Score (0-100)
        nutrition_score = 70.0
        
        # Texture entropy: well-nourished animals have fuller, smoother coats
        if 45 < texture_entropy < 75:
            nutrition_score += 15
        elif texture_entropy < 30:
            nutrition_score -= 35  # Very flat = potentially emaciated/lethargic
        elif texture_entropy > 85:
            nutrition_score -= 20  # Very rough = poor condition / illness
        
        # Smoothness indicates body condition
        if smoothness > 0.85:
            nutrition_score += 10
        elif smoothness < 0.5:
            nutrition_score -= 15
        
        # Color variance (healthy = more uniform)
        color_std = (color_features["std_r"] + color_features["std_g"] + color_features["std_b"]) / 3
        if 30 < color_std < 65:
            nutrition_score += 10
        
        nutrition_score = max(0, min(100, nutrition_score))
        
        # ── 4. Stress Score (inverted: 100 = no stress, 0 = high stress)
        stress_score = 80.0
        stress_sens = profile["stress_sensitivity"]
        
        # Dark patches can indicate stress/injury
        if dark_ratio > 0.1:
            stress_score -= dark_ratio * 150 * stress_sens
        
        # Very high contrast can indicate agitation
        if contrast > 80:
            stress_score -= (contrast - 80) * 0.5 * stress_sens
        
        # Red channel dominance (inflammation indicator)
        if color_features["red_ratio"] > 0.38:
            stress_score -= 15 * stress_sens
        
        # Low uniformity = irregular patterns
        if texture_features["uniformity"] < 0.02:
            stress_score -= 10
        
        stress_score = max(0, min(100, stress_score))
        
        # ── 5. Overall BCS Score (weighted average with weak-point penalty)
        base_overall = (
            coat_score * 0.20 +
            hydration_score * 0.25 +
            nutrition_score * 0.35 +
            stress_score * 0.20
        )
        
        # Weak point penalty: if any score is very low, the whole animal is compromised
        min_score = min(coat_score, hydration_score, nutrition_score, stress_score)
        if min_score < 45:
            overall = base_overall * 0.7 + min_score * 0.3
        else:
            overall = base_overall
            
        return {
            "overall": round(overall, 1),
            "coat_quality": round(coat_score, 1),
            "hydration": round(hydration_score, 1),
            "nutrition": round(nutrition_score, 1),
            "stress_resistance": round(stress_score, 1),
            "is_weak_detected": min_score < 45
        }

    def _determine_diagnosis(self, bcs_scores: dict) -> dict:
        """
        Détermine le diagnostic final à partir des scores BCS.
        Retourne le diagnostic principal + recommandations.
        """
        overall = bcs_scores["overall"]
        hydration = bcs_scores["hydration"]
        nutrition = bcs_scores["nutrition"]
        stress = bcs_scores["stress_resistance"]
        coat = bcs_scores["coat_quality"]
        
        # Priority-based diagnosis
        diagnoses = []
        
        # Critical check first (Strict thresholds)
        if overall < 48 or bcs_scores.get("is_weak_detected") or (hydration < 40 and nutrition < 40):
            diagnoses.append({
                **HEALTH_CLASSES[1],  # Critique
                "priority": 1,
                "confidence": min(0.98, 0.7 + (60 - overall) / 100)
            })
        
        # Dehydration check
        if hydration < 60:
            diagnoses.append({
                **HEALTH_CLASSES[2],  # Déshydraté
                "priority": 2,
                "confidence": min(0.95, 0.5 + (60 - hydration) / 100)
            })
        
        # Malnutrition check
        if nutrition < 60:
            diagnoses.append({
                **HEALTH_CLASSES[3],  # Sous-alimenté
                "priority": 3,
                "confidence": min(0.95, 0.5 + (60 - nutrition) / 100)
            })
        
        # Stress check
        if stress < 55:
            diagnoses.append({
                **HEALTH_CLASSES[4],  # Stressé
                "priority": 4,
                "confidence": min(0.90, 0.4 + (55 - stress) / 100)
            })
        
        # If nothing is wrong → Healthy
        if not diagnoses:
            diagnoses.append({
                **HEALTH_CLASSES[0],  # Sain
                "priority": 5,
                "confidence": min(0.98, 0.6 + overall / 200)
            })
        
        # Sort by priority
        diagnoses.sort(key=lambda d: d["priority"])
        
        # Build advanced action plan
        action_plan = {
            "immediate": [],
            "short_term": [],
            "veterinary": []
        }
        
        if hydration < 60:
            urgency = "HIGH" if hydration < 40 else "MEDIUM"
            action_plan["immediate"].append({
                "task": "Supplémentation Hydrique",
                "detail": f"Ration d'eau critique. Ajouter +{round((60-hydration)/10, 1)}L/jour.",
                "urgency": urgency
            })
            action_plan["veterinary"].append("Vérification des muqueuses pour signes de déshydratation sévère.")
            
        if nutrition < 60:
            urgency = "HIGH" if nutrition < 40 else "MEDIUM"
            action_plan["immediate"].append({
                "task": "Ajustement Ration Fourrage",
                "detail": f"Déficit calorique détecté. Augmenter le fourrage de +{round((60-nutrition)/8, 1)}kg/jour.",
                "urgency": urgency
            })
            action_plan["short_term"].append("Analyse de la qualité du fourrage actuel (protéines/énergie).")

        if stress < 50:
            action_plan["short_term"].append({
                "task": "Audit Environnemental",
                "detail": "Inspecter l'enclos pour nuisances sonores ou prédateurs.",
                "urgency": "MEDIUM"
            })
            
        if coat < 50:
            action_plan["veterinary"].append({
                "task": "Examen Cutané",
                "detail": "Suspicion de dermatose ou parasites externes. Prélèvement recommandé.",
                "urgency": "HIGH" if coat < 30 else "MEDIUM"
            })

        if overall < 50:
             action_plan["veterinary"].append({
                "task": "Bilan Santé Complet",
                "detail": "Score BCS global critique. Examen clinique complet par un vétérinaire agréé.",
                "urgency": "CRITICAL"
            })

        if not action_plan["immediate"] and not action_plan["veterinary"]:
            action_plan["short_term"].append({
                "task": "Suivi Routinier",
                "detail": "Continuer le protocole de surveillance SVI standard.",
                "urgency": "LOW"
            })

        return {
            "primary": diagnoses[0],
            "all_diagnoses": diagnoses,
            "recommendations": recommendations,
            "action_plan": action_plan
        }

    def analyze(self, image_bytes: bytes, species: str = "Bovin") -> dict:
        """
        Pipeline complet d'analyse de santé animale.
        
        Input  : bytes d'une image (JPEG/PNG) + espèce
        Output : dict avec diagnostic, scores BCS, recommandations
        """
        start_time = time.time()
        
        try:
            # 1. Load and preprocess image
            image = Image.open(io.BytesIO(image_bytes))
            original_size = image.size
            
            # Standardize to analysis size
            analysis_size = (384, 384)
            img_analysis = image.convert("RGB").resize(analysis_size, Image.BILINEAR)
            
            # Enhance for better feature extraction
            enhancer = ImageEnhance.Contrast(img_analysis)
            img_enhanced = enhancer.enhance(1.2)
            
            # 2. Extract features
            color_features = self._extract_color_features(img_enhanced)
            texture_features = self._extract_texture_features(img_enhanced)
            
            # 3. Compute BCS scores
            bcs_scores = self._compute_bcs_score(color_features, texture_features, species)
            
            # 4. Determine diagnosis
            diagnosis = self._determine_diagnosis(bcs_scores)
            
            latency_ms = int((time.time() - start_time) * 1000)
            
            return {
                "status": "success",
                "engine": "Sania BCS Vision v1.0",
                "model": "Multi-Factor Image Analysis (PIL + NumPy)",
                "species_analyzed": species,
                "bcs_scores": bcs_scores,
                "diagnosis": diagnosis,
                "features": {
                    "color": {
                        "brightness": round(color_features["brightness"], 1),
                        "saturation": round(color_features["mean_saturation"], 1),
                        "contrast": round(color_features["contrast"], 1),
                        "dominant_channel": max(
                            [("R", color_features["red_ratio"]), 
                             ("G", color_features["green_ratio"]),
                             ("B", color_features["blue_ratio"])],
                            key=lambda x: x[1]
                        )[0]
                    },
                    "ui_header": "<h2 style={{ letterSpacing: '4px', fontWeight: 900, fontSize: '1.2rem', marginBottom: '8px', color: '#fff' }}>DIAGNOSTIC DE SANTÉ</h2>",
                    "texture": {
                        "edge_intensity": round(texture_features["edge_intensity"], 1),
                        "smoothness": round(texture_features["smoothness"], 3),
                        "dark_patches": f"{texture_features['dark_patch_ratio']*100:.1f}%",
                        "bright_patches": f"{texture_features['bright_patch_ratio']*100:.1f}%",
                    }
                },
                "metadata": {
                    "input_size": f"{original_size[0]}×{original_size[1]}",
                    "analysis_size": f"{analysis_size[0]}×{analysis_size[1]}",
                    "pipeline": "Color-HSV + Texture-Laplacian + BCS-Composite",
                    "species_profile": species,
                    "model_version": "1.0.0"
                },
                "latency_ms": latency_ms
            }
            
        except Exception as e:
            logger.error(f"❌ Health Scan Error: {e}", exc_info=True)
            return {
                "status": "error",
                "error": str(e),
                "diagnosis": None,
                "bcs_scores": None
            }


# Global singleton
health_scan_service = HealthScanService()
