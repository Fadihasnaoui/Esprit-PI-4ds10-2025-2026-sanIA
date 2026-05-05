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
import logging
from PIL import Image
try:
    import google.generativeai as genai
except ImportError:
    genai = None
from dotenv import load_dotenv

load_dotenv()

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

EXPERT_PROMPT = """Vous êtes 'Sania Expert Vision', un vétérinaire en chef doté d'une intelligence artificielle experte en Body Condition Scoring (BCS) du bétail.
Votre mission est d'analyser l'état de santé de l'animal présenté sur cette image, spécifiquement l'espèce : {species}.

Effectuez une analyse BCS rigoureuse et factuelle basée sur l'apparence physique (visibilité des côtes, colonne vertébrale, creux des flancs, qualité et brillance du pelage, hydratation perçue, posture).

Vous DEVEZ ABSOLUMENT fournir votre réponse UNIQUEMENT sous la forme d'un objet JSON valide, sans balises markdown autour, suivant EXACTEMENT ce schéma :

{{
    "bcs_scores": {{
        "overall": <Nombre entre 0 et 100>,
        "coat_quality": <Nombre entre 0 et 100>,
        "hydration": <Nombre entre 0 et 100>,
        "nutrition": <Nombre entre 0 et 100>,
        "stress_resistance": <Nombre entre 0 et 100>,
        "is_weak_detected": <Booleen, true si overall < 50>
    }},
    "diagnosis": {{
        "primary": {{
            "id": "<sain | critique | deshydrate | sous_alimente | stresse>",
            "label": "<Sain | Critique | Déshydraté | Sous-alimenté | Stressé>",
            "emoji": "<✅ | 🚨 | 💧 | 🍽️ | ⚡>",
            "color": "<#4ade80 | #ef4444 | #38bdf8 | #fbbf24 | #a78bfa>",
            "confidence": <Nombre entre 0 et 1>
        }},
        "all_diagnoses": [
            {{
                "id": "<id>",
                "label": "<Label>",
                "emoji": "<Emoji>",
                "color": "<Color>",
                "confidence": <Nombre entre 0 et 1>
            }}
        ],
        "action_plan": {{
            "immediate": [
                {{
                    "task": "Tâche Urgente",
                    "detail": "Description détaillée...",
                    "urgency": "HIGH"
                }}
            ],
            "short_term": [
                {{
                    "task": "Tâche de suivi",
                    "detail": "Description...",
                    "urgency": "MEDIUM"
                }}
            ],
            "veterinary": [
                {{
                    "task": "Examen Vétérinaire",
                    "detail": "Description...",
                    "urgency": "CRITICAL"
                }}
            ]
        }}
    }},
    "features": {{
        "color": {{
            "pelage_dominant": "<Couleur>",
            "brillance": "<Normale/Terne/Brillante>"
        }},
        "texture": {{
            "etat_pelage": "<Lisse/Ebouriffe/Etude>",
            "lesions_visibles": "<Aucune/Oui>"
        }}
    }}
}}

Règles impératives de diagnostic vétérinaire :
1. Si l'animal montre des os saillants (côtes visibles, bassin ou vertèbres apparentes), ou des creux importants au niveau des flancs, vous DEVEZ abaisser la note "overall" et "nutrition" SOUS LA BARRE DES 40. Le diagnostic "primary" DOIT alors être "Critique" ou "Sous-alimenté". (L'erreur commune des anciens modèles était de donner "Sain" aux animaux affamés juste car la photo était ensoleillée : NE FAITES PAS CELA).
2. Si le pelage est terne, ébouriffé ou les yeux creusés, baissez "hydration" (< 50) et diagnostiquez "Déshydraté" ou listez-le dans "all_diagnoses".
3. L'action plan "immediate" ou "veterinary" DOIT être rempli en cas de faiblesse. Sinon, laissez les tableaux vides [].
4. Ne répondez QUE par le JSON exact (vérifiez la validité JSON). Aucune phrase avant ou après.

Analysez maintenant précisément l'état de l'animal.
"""


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

    def _fallback_heuristic(self, species: str, error_msg: str = "Erreurs multiples") -> dict:
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
            # 1. Préparation de l'image
            image = Image.open(io.BytesIO(image_bytes))
            image.thumbnail((1024, 1024))
            
            # 2. Appel au modèle Gemini
            # Utilisation de gemini-flash-latest (plus robuste aux changements de version)
            model = genai.GenerativeModel('gemini-flash-latest')
            prompt = EXPERT_PROMPT.replace("{species}", species)
            
            logger.info(f"Analyse {species} via Gemini Flash...")
            
            generation_config = genai.types.GenerationConfig(
                temperature=0.1,
                response_mime_type="application/json"
            )
            
            response = model.generate_content(
                [prompt, image],
                generation_config=generation_config
            )
            
            # 3. Extraction Robuste du JSON
            if not response.candidates or not response.candidates[0].content.parts:
                 raise ValueError("Gemini n'a renvoyé aucun contenu (possible blocage de sécurité).")
            
            text = response.text
            
            # Nettoyage regex pour extraire uniquement le bloc JSON
            json_match = re.search(r'\{.*\}', text, re.DOTALL)
            if not json_match:
                logger.error(f"Format JSON invalide reçu : {text}")
                raise ValueError("Format de réponse IA incompatible.")
                
            result_data = json.loads(json_match.group(0))
            
            # 4. Validation & Defaults (Schema Protection)
            # On s'assure que les clés vitales existent pour éviter les crashes au front
            bcs = result_data.get("bcs_scores", {})
            diag = result_data.get("diagnosis", {})
            feat = result_data.get("features", {})
            
            latency_ms = int((time.time() - start_time) * 1000)
            
            return {
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
                    "input_size": f"{image.width}×{image.height}",
                    "model": "gemini-flash-latest"
                },
                "latency_ms": latency_ms
            }
            
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
