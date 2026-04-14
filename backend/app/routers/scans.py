import io
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form  # type: ignore
from sqlalchemy.orm import Session  # type: ignore
from typing import List, Optional
from PIL import Image
import numpy as np
from ..db.session import get_db  # type: ignore
from ..models.all_models import DiseaseScan, Field, User, UserRole  # type: ignore
from ..schemas.disease import DiseaseScanCreate, DiseaseScanInDB, DetectionResult  # type: ignore
from .deps import get_current_active_user  # type: ignore

router = APIRouter()

# Mean brightness threshold — images below this are too dark
MIN_BRIGHTNESS = 30.0  # out of 255
# Minimum green dominance ratio — leaves are green
MIN_GREEN_RATIO = 0.28  # green channel must be at least 28% of total pixel energy


def _check_image_quality(image_bytes: bytes) -> Optional[str]:
    """
    Returns an error string if the image fails quality checks, else None.
    Checks:
    1. Too dark  (mean brightness < MIN_BRIGHTNESS)
    2. Too uniform/blank (std dev < 8 → solid color / black screen)
    3. Not green enough (green channel too low → not a leaf)
    """
    try:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img_small = img.resize((64, 64))
        arr = np.array(img_small, dtype=np.float32)
        mean_brightness = float(arr.mean())
        std_dev = float(arr.std())

        if mean_brightness < MIN_BRIGHTNESS:
            return (
                f"Image is too dark (brightness {mean_brightness:.0f}/255). "
                "Please take the photo in good lighting."
            )
        if std_dev < 8.0:
            return (
                "Image appears to be blank or a solid color. "
                "Please take a clear photo of a plant leaf."
            )

        # Green channel dominance check
        r_mean = float(arr[:, :, 0].mean())
        g_mean = float(arr[:, :, 1].mean())
        b_mean = float(arr[:, :, 2].mean())
        total = r_mean + g_mean + b_mean
        if total > 0 and (g_mean / total) < MIN_GREEN_RATIO:
            return (
                "No plant leaf detected in this image. "
                "Please take a close-up photo of a leaf."
            )
    except Exception:
        pass  # If we can't check, let inference run and apply confidence threshold
    return None


@router.get("/", response_model=List[DiseaseScanInDB])
def read_scans(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    # Use outerjoin so scans without a field_id are still returned
    query = db.query(DiseaseScan).outerjoin(Field)
    if current_user.role == UserRole.FARMER:
        query = query.filter(
            (DiseaseScan.field_id == None) | (Field.farm_id == current_user.farm_id)
        )
    return query.order_by(DiseaseScan.created_at.desc()).all()


@router.post("/detect", response_model=DetectionResult)
async def detect_disease(
    image: UploadFile = File(...),
    field_id: Optional[str] = Form(None),
    crop_type: Optional[str] = Form(None),

    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Upload a plant image and run TFLite disease detection.
    """
    if image.content_type not in ("image/jpeg", "image/png", "image/jpg", "image/webp"):
        raise HTTPException(status_code=400, detail="Only JPEG/PNG images are supported")

    image_bytes = await image.read()
    if len(image_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image exceeds 10 MB limit")

    # ── Guard 1: Image quality check (brightness / blank) ────────────────────
    quality_error = _check_image_quality(image_bytes)
    if quality_error:
        raise HTTPException(status_code=422, detail=quality_error)

    # ── Guard 2: Model availability ──────────────────────────────────────────
    from ..services.disease_detection import predict, predict_severity, is_model_available
    if not is_model_available():
        raise HTTPException(
            status_code=503,
            detail="Disease detection model is not available on this server",
        )

    # ── Guard 3: Run inference ────────────────────────────────────────────────
    try:
        predicted_disease, confidence, top5 = predict(image_bytes)
        # Only run severity if it's NOT a healthy leaf
        severity_pct, severity_label, severity_color = 0.0, None, None
        if "healthy" not in predicted_disease.lower() and predicted_disease != "Background_without_leaves":
            severity_pct, severity_label, severity_color = predict_severity(image_bytes)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Inference error: {str(exc)}")

    # ── Guard 4: Background / no-leaf class ──────────────────────────────────
    # If the model's top pick is "no leaf", fall back to the next best disease
    # class from the top-5 so unknown plant types still get a useful result.
    if predicted_disease == "Background_without_leaves":
        non_bg = [t for t in top5 if t["disease"] != "Background_without_leaves"]
        if non_bg:
            # Always use the best non-background class — let confidence threshold decide
            predicted_disease = non_bg[0]["disease"]
            confidence = non_bg[0]["confidence"]
        else:
            raise HTTPException(
                status_code=422,
                detail=(
                    "No plant leaf detected in this image. "
                    "Please take a close-up photo of a leaf."
                ),
            )

    # ── Guard 5: Confidence threshold ────────────────────────────────────────
    if confidence < 0.40:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Could not confidently identify a disease (confidence: {round(confidence*100)}%). "
                "Please use a clearer, well-lit photo of a single leaf."
            ),
        )

    # ── Save to DB (always save so history is populated) ─────────────────────
    saved_id = None
    resolved_field_id = None
    if field_id:
        field = db.query(Field).filter(Field.id == field_id).first()
        if field:
            if current_user.role == UserRole.FARMER and field.farm_id != current_user.farm_id:
                raise HTTPException(status_code=403, detail="Forbidden")
            resolved_field_id = field.id
            crop_type = crop_type or field.crop_type

    db_scan = DiseaseScan(
        field_id=resolved_field_id,
        crop_type=crop_type or "Unknown",
        image_url="uploaded_via_mobile",
        predicted_disease=predicted_disease,
        confidence=confidence,
        severity_pct=severity_pct if severity_label else None,
        severity_label=severity_label,
        severity_color=severity_color,
    )
    db.add(db_scan)
    db.commit()
    db.refresh(db_scan)
    saved_id = str(db_scan.id)

    return DetectionResult(
        predicted_disease=predicted_disease,
        confidence=confidence,
        top5=top5,
        saved_scan_id=saved_id,
        severity_pct=severity_pct if severity_label else None,
        severity_label=severity_label,
        severity_color=severity_color,
    )


@router.post("/", response_model=DiseaseScanInDB)
def create_scan(
    scan_in: DiseaseScanCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    field = db.query(Field).filter(Field.id == scan_in.field_id).first()
    if not field:
        raise HTTPException(status_code=404, detail="Field not found")
    if current_user.role == UserRole.FARMER and field.farm_id != current_user.farm_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    db_scan = DiseaseScan(**scan_in.dict())
    db.add(db_scan)
    db.commit()
    db.refresh(db_scan)
    return db_scan
