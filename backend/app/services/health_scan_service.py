"""
Health Scan Service — Diagnostic Vétérinaire Expert par Vision IA
============================================================
Architecture : Gemini Vision (google-generativeai) + Expert Prompting
Diagnostics  : Sain | Critique | Déshydraté | Sous-alimenté | Stressé
"""

import os
import io
import time
import json
import re
import hashlib
import logging

from PIL import Image
try:
    import google.generativeai as genai
except ImportError:
    genai = None
from dotenv import load_dotenv

load_dotenv()

# 512px keeps the image in a single Gemini tile AND reduces JPEG upload size.
_MAX_IMAGE_DIM  = 512
_JPEG_QUALITY   = 72
_MODEL_TIMEOUT  = 12          # seconds per model attempt
_MAX_OUT_TOKENS = 2048        # full BCS JSON needs ~800-1200 tokens

# In-memory result cache: keyed on (image_sha256, species).
# Holds up to 32 recent analyses — resets on server restart.
_RESULT_CACHE: dict = {}
_CACHE_MAX = 32

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configure API
API_KEY = os.getenv("GEMINI_API_KEY")
if API_KEY and genai:
    genai.configure(api_key=API_KEY)
else:
    logger.warning("⚠️ GEMINI_API_KEY non trouvée dans .env ou SDK manquant ! Le Health Scan expert échouera.")

# Fallback classes (used only in fallback mode or referencing structure)
HEALTH_CLASSES = [
    {
        "id": "sain",
        "label": "Sain",
        "emoji": "✅",
        "color": "#4ade80"
    },
    {
        "id": "critique",
        "label": "Critique",
        "emoji": "🚨",
        "color": "#ef4444"
    },
    {
        "id": "deshydrate",
        "label": "Déshydraté",
        "emoji": "💧",
        "color": "#38bdf8"
    },
    {
        "id": "sous_alimente",
        "label": "Sous-alimenté",
        "emoji": "🍽️",
        "color": "#fbbf24"
    },
    {
        "id": "stresse",
        "label": "Stressé",
        "emoji": "⚡",
        "color": "#a78bfa"
    }
]

EXPERT_PROMPT = (
    "You are a veterinary AI. Analyze this {species} image for body condition scoring (BCS). "
    "Reply with ONLY a valid JSON object, no markdown, no explanation.\n"
    "Required fields:\n"
    "bcs_scores: overall(0-100), coat_quality(0-100), hydration(0-100), nutrition(0-100), "
    "stress_resistance(0-100), is_weak_detected(boolean)\n"
    "diagnosis.primary: id(sain|critique|deshydrate|sous_alimente|stresse), "
    "label(Sain|Critique|Déshydraté|Sous-alimenté|Stressé), "
    "emoji(✅|🚨|💧|🍽️|⚡), color(#4ade80|#ef4444|#38bdf8|#fbbf24|#a78bfa), confidence(0-1)\n"
    "diagnosis.all_diagnoses: array of same structure for all applicable conditions\n"
    "diagnosis.action_plan: immediate[], short_term[], veterinary[] — each item has task, detail, urgency\n"
    "features.color: pelage_dominant(string), brillance(Normale|Terne|Brillante)\n"
    "features.texture: etat_pelage(Lisse|Ebouriffe), lesions_visibles(Aucune|Oui)\n"
    "RULES: visible ribs/spine/hollow flanks → overall<40, nutrition<40, id=critique or sous_alimente. "
    "Dull coat/sunken eyes → hydration<50, include deshydrate. "
    "Leave action_plan arrays empty if animal is healthy. Output JSON only."
)


class HealthScanService:
    """
    Service ultra-avancé d'analyse de santé animale par vision IA (Gemini VLM API).
    """
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(HealthScanService, cls).__new__(cls)
            cls._instance.initialized = True
            logger.info("🏥 Health Scan Expert Engine (Gemini API): Initialized")
        return cls._instance

    @staticmethod
    def _parse_json(text: str) -> dict | None:
        """Extract a JSON object from any Gemini response format."""
        text = text.strip()
        # 1. Pure JSON
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass
        # 2. Markdown code block: ```json {...} ``` or ``` {...} ```
        md = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
        if md:
            try:
                return json.loads(md.group(1))
            except json.JSONDecodeError:
                pass
        # 3. First balanced { ... } in arbitrary text
        start = text.find("{")
        if start != -1:
            depth = 0
            for i, ch in enumerate(text[start:], start):
                if ch == "{":
                    depth += 1
                elif ch == "}":
                    depth -= 1
                    if depth == 0:
                        try:
                            return json.loads(text[start : i + 1])
                        except json.JSONDecodeError:
                            break
        return None

    def _fallback_heuristic(self, _species: str, error_msg: str = "Erreurs multiples") -> dict:
        """Fallback clairs en cas de failure de l'API Gemini ou clé manquante."""
        return {
            "bcs_scores": {
                "overall": 0, "coat_quality": 0, "hydration": 0, "nutrition": 0, "stress_resistance": 0,
                "is_weak_detected": False
            },
            "diagnosis": {
                "primary": {
                    "id": "error",
                    "label": "IA Indisponible",
                    "emoji": "⚠️",
                    "color": "#94a3b8",
                    "confidence": 0
                },
                "all_diagnoses": [],
                "action_plan": {
                    "immediate": [{"task": "Vérification système", "detail": f"Raison : {error_msg}", "urgency": "MEDIUM"}],
                    "short_term": [],
                    "veterinary": []
                }
            },
            "features": {"color": {}, "texture": {}}
        }

    def analyze(self, image_bytes: bytes, species: str = "Bovin") -> dict:
        start_time = time.time()

        # --- Cache lookup ---
        cache_key = (hashlib.sha256(image_bytes).hexdigest(), species)
        if cache_key in _RESULT_CACHE:
            cached = dict(_RESULT_CACHE[cache_key])
            cached["latency_ms"] = 0
            cached["cached"] = True
            logger.info("Health scan cache hit for species=%s", species)
            return cached

        if not API_KEY or not genai:
            logger.error("❌ Pas de clé GEMINI_API_KEY ou module introuvable !")
            fb = self._fallback_heuristic(species, "Clé API manquante ou module genai non installé")
            return {
                "status": "error",
                "error": "Configuration IA incomplète.",
                **fb,
                "latency_ms": 10
            }

        try:
            # 1. Resize + compress to JPEG bytes — controls upload size precisely
            pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            pil_img.thumbnail((_MAX_IMAGE_DIM, _MAX_IMAGE_DIM), Image.LANCZOS)
            buf = io.BytesIO()
            pil_img.save(buf, format="JPEG", quality=_JPEG_QUALITY, optimize=True)
            jpeg_bytes = buf.getvalue()
            image_part = {"mime_type": "image/jpeg", "data": jpeg_bytes}

            # 2. Cascade modèles avec timeout par tentative
            _MODELS = [
                "gemini-2.5-flash-lite",   # fastest available — flash-lite-latest gives 504
                "gemini-2.5-flash",
                "gemini-flash-latest",
            ]
            prompt = EXPERT_PROMPT.replace("{species}", species)

            # Two configs: with JSON mime type (cleaner output), fallback without
            _cfg_json = genai.types.GenerationConfig(
                temperature=0.1, max_output_tokens=_MAX_OUT_TOKENS,
                response_mime_type="application/json"
            )
            _cfg_text = genai.types.GenerationConfig(
                temperature=0.1, max_output_tokens=_MAX_OUT_TOKENS
            )

            response = None
            for model_name in _MODELS:
                for cfg in (_cfg_json, _cfg_text):
                    try:
                        model = genai.GenerativeModel(model_name)
                        response = model.generate_content(
                            [prompt, image_part],
                            generation_config=cfg,
                            request_options={"timeout": _MODEL_TIMEOUT},
                        )
                        logger.info("Analyse %s via %s (%dx%dpx, %dkB).",
                                    species, model_name, pil_img.width, pil_img.height,
                                    len(jpeg_bytes) // 1024)
                        break
                    except Exception as model_err:
                        logger.warning("Model %s cfg=%s failed: %s",
                                       model_name, cfg.response_mime_type or "text", model_err)
                if response is not None:
                    break

            if response is None:
                raise ValueError("Aucun modèle Gemini disponible.")

            # 3. Extraction JSON robuste — gère JSON pur, markdown code blocks, JSON noyé dans du texte
            if not response.candidates or not response.candidates[0].content.parts:
                raise ValueError("Gemini n'a renvoyé aucun contenu (blocage sécurité possible).")

            raw = response.text.strip()
            result_data = self._parse_json(raw)

            if result_data is None:
                logger.error("Réponse non parseable (100 premiers chars) : %s", raw[:100])
                raise ValueError("Format de réponse IA incompatible.")
            
            # 4. Validation & Defaults (Schema Protection)
            # On s'assure que les clés vitales existent pour éviter les crashes au front
            bcs = result_data.get("bcs_scores", {})
            diag = result_data.get("diagnosis", {})
            feat = result_data.get("features", {})
            
            latency_ms = int((time.time() - start_time) * 1000)

            result = {
                "status": "success",
                "engine": "Sania BCS Vision Expert (Gemini API)",
                "species_analyzed": species,
                "bcs_scores": {
                    "overall": bcs.get("overall", 0),
                    "coat_quality": bcs.get("coat_quality", 0),
                    "hydration": bcs.get("hydration", 0),
                    "nutrition": bcs.get("nutrition", 0),
                    "stress_resistance": bcs.get("stress_resistance", 0),
                    "is_weak_detected": bcs.get("is_weak_detected", False)
                },
                "diagnosis": {
                    "primary": diag.get("primary") or HEALTH_CLASSES[0],
                    "all_diagnoses": diag.get("all_diagnoses") or [],
                    "action_plan": diag.get("action_plan") or {"immediate": [], "short_term": [], "veterinary": []}
                },
                "features": feat,
                "metadata": {
                    "input_size": f"{pil_img.width}×{pil_img.height}",
                    "model": "gemini-1.5-flash"
                },
                "latency_ms": latency_ms,
                "cached": False,
            }

            # Store in cache (evict oldest entry if full)
            if len(_RESULT_CACHE) >= _CACHE_MAX:
                oldest_key = next(iter(_RESULT_CACHE))
                del _RESULT_CACHE[oldest_key]
            _RESULT_CACHE[cache_key] = result

            return result
            
        except Exception as e:
            logger.error(f"❌ Health Scan Error: {e}")
            fb = self._fallback_heuristic(species, str(e))
            return {
                "status": "error",
                "error": f"Diagnostic interrompu : {str(e)}",
                **fb,
                "latency_ms": int((time.time() - start_time) * 1000)
            }

# Global singleton
health_scan_service = HealthScanService()
