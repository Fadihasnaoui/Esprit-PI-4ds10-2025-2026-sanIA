from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Literal
from sqlalchemy.orm import Session

from ..routers.deps import get_current_active_user
from ..models.all_models import User
from ..db.session import get_db
from ..services import rag_service

router = APIRouter()


class QuestionRequest(BaseModel):
    question: str
    conversation_id: str | None = None


class SourceItem(BaseModel):
    rank: int
    score: float
    source: str
    filename: str
    chunk_id: int


class AnswerResponse(BaseModel):
    answer: str
    sources: List[SourceItem]
    conversation_id: str


class HistoryItem(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ConversationHistoryResponse(BaseModel):
    conversation_id: str
    history: List[HistoryItem]


class ConversationListItem(BaseModel):
    id: str
    title: str
    updated_at: str
    message_count: int


class ConversationListResponse(BaseModel):
    conversations: List[ConversationListItem]


class IndexResponse(BaseModel):
    indexed: int
    message: str


@router.post("/ask", response_model=AnswerResponse)
def ask_rag(
    body: QuestionRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    try:
        result = rag_service.query_rag(
            db=db,
            question=body.question,
            user_id=str(current_user.id),
            conversation_id=body.conversation_id,
        )
        return AnswerResponse(**result)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.get("/conversations", response_model=ConversationListResponse)
def list_conversations(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    convs = rag_service.list_conversations(db, str(current_user.id))
    return ConversationListResponse(conversations=convs)


@router.get("/conversations/{conversation_id}", response_model=ConversationHistoryResponse)
def get_conversation_history(
    conversation_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    history = rag_service.get_conversation_history(db, str(current_user.id), conversation_id)
    return ConversationHistoryResponse(conversation_id=conversation_id, history=history)


@router.delete("/conversations/{conversation_id}")
def clear_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    deleted = rag_service.clear_conversation(db, str(current_user.id), conversation_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Conversation introuvable.")
    return {"message": "Conversation supprimée."}


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