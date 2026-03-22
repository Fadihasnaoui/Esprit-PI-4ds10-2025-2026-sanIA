from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
import os
import shutil
from ..db.session import get_db
from ..models.all_models import User
from .deps import get_current_active_user
from ..services.ai_service import AIService
from fastapi.responses import StreamingResponse
import json

router = APIRouter()
ai_service = AIService()

# Ensure temp directory exists for uploads
UPLOAD_DIR = "uploads/ai_docs"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/chat")
async def chat_with_ai(
    message: str = Form(...),
    history: str = Form("[]"),
    current_user: User = Depends(get_current_active_user)
):
    """
    Advanced AI Chat endpoint for farmers.
    Handles general queries and uses personal RAG context.
    """
    try:
        chat_history = json.loads(history)
        
        async def response_generator():
            async for chunk in ai_service.get_chat_response_stream(message, chat_history, current_user.id):
                yield chunk

        return StreamingResponse(response_generator(), media_type="text/event-stream")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user)
):
    """
    Upload a document (PDF or Image) to be used in RAG.
    """
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in [".pdf", ".jpg", ".jpeg", ".png"]:
        raise HTTPException(status_code=400, detail="Only PDF and Image files are supported.")

    file_path = os.path.join(UPLOAD_DIR, f"{current_user.id}_{file.filename}")
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        # Process the file for RAG (Extract text or analyze image)
        await ai_service.process_document(file_path, current_user.id)
        return {"filename": file.filename, "status": "processed", "message": "File successfully uploaded and indexed."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error indexing document: {str(e)}")

@router.get("/context")
async def get_ai_context(current_user: User = Depends(get_current_active_user)):
    """
    See what documents the AI currently has in its knowledge base for this user.
    """
    return ai_service.get_user_context_info(current_user.id)

@router.delete("/context")
async def clear_ai_context(current_user: User = Depends(get_current_active_user)):
    """
    Clear the user's AI knowledge base.
    """
    ai_service.clear_user_context(current_user.id)
    return {"status": "success", "message": "Knowledge base cleared."}
