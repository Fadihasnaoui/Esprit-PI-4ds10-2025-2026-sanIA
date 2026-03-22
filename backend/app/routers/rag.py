from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List

from ..routers.deps import get_current_active_user
from ..models.all_models import User
from ..services import rag_service

router = APIRouter()


class QuestionRequest(BaseModel):
    question: str


class SourceItem(BaseModel):
    rank: int
    score: float
    source: str
    filename: str
    chunk_id: int


class AnswerResponse(BaseModel):
    answer: str
    sources: List[SourceItem]


class IndexResponse(BaseModel):
    indexed: int
    message: str


@router.post("/ask", response_model=AnswerResponse)
def ask_rag(
    body: QuestionRequest,
    current_user: User = Depends(get_current_active_user),
):
    try:
        result = rag_service.query_rag(body.question)
        return AnswerResponse(**result)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.post("/index", response_model=IndexResponse)
def rebuild_index(
    current_user: User = Depends(get_current_active_user),
):
    count = rag_service.build_index()
    return IndexResponse(
        indexed=count,
        message=f"FAISS index built with {count} chunks." if count > 0
                else "No data files found — index is empty.",
    )