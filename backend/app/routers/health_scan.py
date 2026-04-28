"""
Health Scan Router — Diagnostic Vétérinaire par Vision IA
=========================================================
Endpoint : POST /api/v1/health-scan/analyze
Pipeline : Upload Image + Species → BCS Analysis → Health Report
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
from ..db.session import get_db
from ..services.health_scan_service import health_scan_service
from .deps import get_current_active_user
from ..models.all_models import User, Animal

router = APIRouter()


@router.post("/analyze")
async def analyze_animal_health(
    file: UploadFile = File(...),
    species: str = Query("Bovin", description="Espèce de l'animal: Bovin, Ovin, Caprin, Cheval, Volaille"),
    animal_id: str = Query(None, description="ID de l'animal (optionnel, pour liaison au dossier)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    🏥 Analyse de santé animale par vision IA.
    
    Pipeline BCS (Body Condition Scoring) :
    1. Réception de l'image
    2. Extraction de features chromatiques (RGB/HSV)  
    3. Analyse de texture (Laplacien, entropie)
    4. Scoring multi-facteur (pelage, hydratation, nutrition, stress)
    5. Diagnostic final avec recommandations
    
    Diagnostics possibles :
    - ✅ Sain : État corporel optimal
    - 🚨 Critique : Intervention vétérinaire urgente
    - 💧 Déshydraté : Apport en eau insuffisant
    - 🍽️ Sous-alimenté : Ration alimentaire insuffisante
    - ⚡ Stressé : Facteurs de stress environnementaux
    """
    # Validate file type
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail="Le fichier doit être une image (JPEG, PNG, etc.)"
        )
    
    # Read image bytes
    image_bytes = await file.read()
    
    if len(image_bytes) < 1000:
        raise HTTPException(
            status_code=400,
            detail="L'image semble corrompue ou trop petite."
        )
    
    # Validate species
    valid_species = ["Bovin", "Ovin", "Caprin", "Cheval", "Volaille"]
    if species not in valid_species:
        species = "Bovin"  # Fallback
    
    # If animal_id is provided, fetch species from database
    animal_info = None
    if animal_id:
        animal = db.query(Animal).filter(Animal.id == animal_id).first()
        if animal:
            species = animal.species or species
            animal_info = {
                "id": animal.id,
                "tag_id": animal.tag_id,
                "species": animal.species,
                "breed": animal.breed
            }
    
    # Run analysis
    result = health_scan_service.analyze(image_bytes, species=species)
    
    # We allow "error" status to return but we handle the HTTP exception at the end of the logical flow 
    # to allow returning partial results or specific error structures if needed.
    
    # Update animal status in database if animal_id provided AND analysis was roughly successful
    if animal_id and result.get("status") == "success":
        animal = db.query(Animal).filter(Animal.id == animal_id).first()
        if animal:
            # Safely extract diagnosis label
            diag_obj = result.get("diagnosis", {})
            primary = diag_obj.get("primary", {})
            diagnosis_label = primary.get("label", "Sain")
            
            # Map labels to DB status if necessary, or just store the label
            animal.status = diagnosis_label
            db.commit()
            db.refresh(animal)
            
            animal_info = {
                "id": animal.id,
                "tag_id": animal.tag_id,
                "species": animal.species,
                "breed": animal.breed,
                "current_status": animal.status
            }
            result["animal"] = animal_info
    
    # If the service returned an error status, we can still return the partial JSON (fallback) 
    # but with a 200 OK if we want the front to show the "IA Indisponible" state gracefully,
    # OR we raise 500 if it's a hard crash. 
    # Here, we'll return 200 with the "error" status inside the JSON so the modal can show its custom error UI.
    return result


@router.get("/status")
def get_health_scan_status():
    """Retourne le statut du moteur de diagnostic BCS."""
    return {
        "engine": "Sania BCS Vision v1.0",
        "model": "Multi-Factor Image Analysis",
        "pipeline": "Color-HSV + Texture-Laplacian + BCS-Composite",
        "diagnostics": ["Sain", "Critique", "Déshydraté", "Sous-alimenté", "Stressé"],
        "species_supported": ["Bovin", "Ovin", "Caprin", "Cheval", "Volaille"],
        "status": "READY"
    }
