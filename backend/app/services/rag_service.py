from __future__ import annotations
import io
import csv
import json
import logging
import pickle
import uuid
from pathlib import Path
from typing import List, Dict, Any, Generator
import numpy as np
from pypdf import PdfReader
from openai import OpenAI
from sqlalchemy.orm import Session
from sqlalchemy.sql import func

from ..core.config import settings
from ..db.session import engine
from ..models.all_models import RagConversation, RagMessage

logger = logging.getLogger(__name__)

# ── Globals ───────────────────────────────────────────────────────────────────
_index = None
_chunks: List[str] = []
_chunk_metadata: List[Dict[str, Any]] = []
_model = None
MAX_HISTORY_TURNS = 6

DATA_DIR = Path(settings.RAG_DATA_DIR)
_PERSIST_DIR = DATA_DIR.parent
INDEX_FILE = _PERSIST_DIR / "vector_index.bin"
METADATA_FILE = _PERSIST_DIR / "metadata.pkl"
ARABIC_XLSX = "translated_agronomic_ar.xlsx"

# ── Token Factory client ──────────────────────────────────────────────────────
# Variables à ajouter dans .env :
#   TOKEN_FACTORY_API_KEY=votre_clé
#   TOKEN_FACTORY_BASE_URL=https://tokenfactory.esprit.tn/api
#   TOKEN_FACTORY_MODEL=hosted_vllm/Llama-3.1-70B-Instruct

def _get_client() -> OpenAI:
    return OpenAI(
        api_key=settings.TOKEN_FACTORY_API_KEY,
        base_url=settings.TOKEN_FACTORY_BASE_URL,
    )


def _call_llm(prompt: str, system: str, max_tokens: int) -> str:
    """Appel LLM synchrone — retourne la réponse complète."""
    response = _get_client().chat.completions.create(
        model=settings.TOKEN_FACTORY_MODEL,
        messages=[
            {"role": "system", "content": system},
            {"role": "user",   "content": prompt},
        ],
        temperature=0.3,
        max_tokens=max_tokens,
        top_p=0.9,
        frequency_penalty=0.0,
        presence_penalty=0.0,
    )
    return response.choices[0].message.content.strip()


def _stream_llm(prompt: str, system: str, max_tokens: int) -> Generator[str, None, None]:
    """Appel LLM en streaming — yield les tokens un à un."""
    stream = _get_client().chat.completions.create(
        model=settings.TOKEN_FACTORY_MODEL,
        messages=[
            {"role": "system", "content": system},
            {"role": "user",   "content": prompt},
        ],
        temperature=0.3,
        max_tokens=max_tokens,
        top_p=0.9,
        frequency_penalty=0.0,
        presence_penalty=0.0,
        stream=True,
    )
    for chunk in stream:
        token = chunk.choices[0].delta.content
        if token:
            yield token


# ── Embedding model (singleton) ───────────────────────────────────────────────
def _get_model():
    """Charge SentenceTransformer une seule fois en mémoire."""
    global _model
    if _model is None:
        logger.info("Loading embedding model all-MiniLM-L6-v2 on CPU …")
        from sentence_transformers import SentenceTransformer
        try:
            _model = SentenceTransformer("all-MiniLM-L6-v2", device="cpu")
        except Exception as first_error:
            logger.warning(f"Embedding load (cpu) failed: {first_error}. Retrying without device=…")
            _model = SentenceTransformer("all-MiniLM-L6-v2")
        logger.info("Embedding model loaded.")
    return _model


# ── Text extractors ───────────────────────────────────────────────────────────
def _extract_txt(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="ignore")


def _extract_pdf(path: Path) -> str:
    reader = PdfReader(str(path))
    return "\n".join(
        p.extract_text() for p in reader.pages if p.extract_text()
    )


def _extract_csv(path: Path) -> str:
    lines = []
    try:
        content = path.read_text(encoding="utf-8", errors="ignore")
        for row in csv.DictReader(io.StringIO(content)):
            parts = [f"{k}: {v}" for k, v in row.items() if v]
            lines.append(" | ".join(parts))
    except Exception as e:
        logger.warning(f"Could not parse CSV {path}: {e}")
    return "\n".join(lines)


def _extract_xlsx(path: Path) -> str:
    import pandas as pd
    lines = []
    try:
        df = pd.read_excel(path, engine="openpyxl")
        for _, row in df.iterrows():
            parts = [
                f"{col}: {val}" for col, val in row.items()
                if pd.notna(val) and str(val).strip()
            ]
            if parts:
                lines.append(" | ".join(parts))
    except Exception as e:
        logger.warning(f"Could not parse XLSX {path}: {e}")
    return "\n".join(lines)


# ── Chunking ──────────────────────────────────────────────────────────────────
def _chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> List[str]:
    words = text.split()
    chunks, start = [], 0
    while start < len(words):
        chunk = " ".join(words[start:start + chunk_size])
        if chunk.strip():
            chunks.append(chunk)
        start += chunk_size - overlap
    return chunks


# ── Index management ──────────────────────────────────────────────────────────
def build_index() -> int:
    global _index, _chunks, _chunk_metadata
    import faiss

    all_chunks: List[str] = []
    all_metadata: List[Dict[str, Any]] = []

    if not DATA_DIR.exists():
        logger.warning(f"RAG data directory not found: {DATA_DIR}")
        return 0

    extractors = {
        ".pdf": _extract_pdf,
        ".txt": _extract_txt,
        ".csv": _extract_csv,
        ".xlsx": _extract_xlsx,
    }

    for fpath in DATA_DIR.rglob("*"):
        if not fpath.is_file() or fpath in [INDEX_FILE, METADATA_FILE]:
            continue
        extract = extractors.get(fpath.suffix.lower())
        if not extract:
            continue

        logger.info(f"Ingesting {fpath.name} …")
        try:
            chunks = _chunk_text(extract(fpath))
            for i, chunk in enumerate(chunks):
                all_chunks.append(chunk)
                all_metadata.append({
                    "source":   str(fpath.relative_to(DATA_DIR)),
                    "filename": fpath.name,
                    "chunk_id": i,
                    "content":  chunk,
                })
            logger.info(f"  → {len(chunks)} chunks")
        except Exception as e:
            logger.error(f"Error ingesting {fpath.name}: {e}")

    if not all_chunks:
        logger.warning("No chunks generated — index is empty.")
        _chunks, _chunk_metadata, _index = [], [], None
        return 0

    model = _get_model()
    logger.info(f"Embedding {len(all_chunks)} chunks …")
    embeddings = np.array(
        model.encode(all_chunks, batch_size=64, show_progress_bar=False),
        dtype="float32",
    )

    idx = faiss.IndexFlatL2(embeddings.shape[1])
    idx.add(embeddings)
    _index, _chunks, _chunk_metadata = idx, all_chunks, all_metadata

    try:
        faiss.write_index(idx, str(INDEX_FILE))
        with open(METADATA_FILE, "wb") as f:
            pickle.dump({"chunks": _chunks, "metadata": _chunk_metadata}, f)
        logger.info(f"Index persisted: {INDEX_FILE}")
    except Exception as e:
        logger.error(f"Failed to persist index: {e}")

    logger.info(f"FAISS index built: {len(all_chunks)} chunks, dim={embeddings.shape[1]}")
    return len(all_chunks)


def load_index() -> bool:
    global _index, _chunks, _chunk_metadata
    if not INDEX_FILE.exists() or not METADATA_FILE.exists():
        logger.info("No persisted RAG index found.")
        return False
    import faiss
    try:
        _index = faiss.read_index(str(INDEX_FILE))
        with open(METADATA_FILE, "rb") as f:
            data = pickle.load(f)
        _chunks, _chunk_metadata = data["chunks"], data["metadata"]
        logger.info(f"Index loaded: {len(_chunks)} chunks.")
        return True
    except Exception as e:
        logger.error(f"Error loading index: {e}")
        return False


# ── Détection langue ──────────────────────────────────────────────────────────
def _is_arabic(text: str) -> bool:
    """Vrai si plus de 20% des caractères sont arabes."""
    if not text:
        return False
    arabic = sum(1 for c in text if '\u0600' <= c <= '\u06FF')
    return arabic / len(text) > 0.2


def _is_greeting(text: str) -> bool:
    """Vrai si le message est une simple salutation."""
    greetings = {
        # FR
        "bonjour", "bonsoir", "salut", "coucou", "hey", "bjr", "bsr", "bj",
        "ca va", "ça va", "comment vas-tu", "comment allez-vous",
        "merci", "au revoir", "bye",
        # EN
        "hello", "hi", "good morning", "good evening", "thanks", "goodbye",
        # AR
        "مرحبا", "أهلا", "السلام عليكم", "صباح الخير", "مساء الخير",
        "كيف حالك", "شكرا", "وداعا",
    }
    clean = text.lower().strip().rstrip("?! ،.")
    return clean in greetings


# ── Retrieval ─────────────────────────────────────────────────────────────────
def _retrieve(question: str, top_k: int) -> List[Dict[str, Any]]:
    global _index
    if _index is None and not load_index():
        return []

    try:
        model = _get_model()
    except Exception as e:
        logger.error(f"Embedding model initialization failed: {e}")
        raise RuntimeError(
            "Embedding model failed to initialize. Check torch/transformers compatibility in backend environment."
        ) from e
    q_vec = np.array(
        model.encode([question], show_progress_bar=False),
        dtype="float32",
    )

    arabic_mode = _is_arabic(question)
    search_k = min(top_k * 4 if arabic_mode else top_k, len(_chunks))

    distances, indices = _index.search(q_vec, search_k)
    results = [
        {
            "rank":     rank,
            "score":    float(dist),
            "source":   _chunk_metadata[idx]["source"],
            "filename": _chunk_metadata[idx]["filename"],
            "chunk_id": _chunk_metadata[idx]["chunk_id"],
            "content":  _chunk_metadata[idx]["content"],
        }
        for rank, (idx, dist) in enumerate(zip(indices[0], distances[0]), 1)
        if 0 <= idx < len(_chunks)
    ]

    if not arabic_mode:
        return results[:top_k]

    # Mode arabe : prioriser les chunks du fichier arabe
    arabic = [r for r in results if r["filename"] == ARABIC_XLSX]
    merged = arabic[:top_k] if arabic else results[:top_k]
    if not arabic:
        logger.warning("[Arabic] No Arabic chunks found, fallback to all.")

    for i, item in enumerate(merged, 1):
        item["rank"] = i

    logger.info(f"[Arabic] {len(arabic)} chunks arabes → {len(merged)} retournés.")
    return merged


# ── Helpers prompt ────────────────────────────────────────────────────────────
def _build_prompt(question: str, context: str) -> tuple[str, str]:
    """Retourne (system, user_prompt) selon la langue détectée."""
    if _is_arabic(question):
        system = (
            "أنت سانيا، خبيرة زراعية لمنصة Sania AgriSmart. "
            "أجب باللغة العربية فقط، بإيجاز ووضوح. "
            "ممنوع أن تطلب من المستخدم استشارة خبير آخر أو مختص آخر؛ أنت الخبيرة التي تقدّم التوصية مباشرة."
        )
        prompt = (
            f"السياق من قاعدة البيانات الزراعية:\n{context}\n\n"
            f"السؤال: {question}\n\n"
            "حدد المرض أو الآفة، أعراضه، والعلاج بالتفصيل."
            "العلاج يجب أن يحتوي على:"
            "- نوع العلاج (مبيد فطري، حشري، ممارسات زراعية)"
            "- مثالين على الأقل لمواد فعالة (مثل مانكوزيب، ميتالاكسيل…)"
            "- توقيت التطبيق (وقائي، بداية الإصابة، علاج)"
            "- إجراءات ميدانية واضحة"
            "هيكل الإجابة يجب أن يكون:"
            "- المرض:"
            "- الأعراض:"
            "- العلاج:"
            "   • علاج كيميائي:"
            "   • ممارسات زراعية:"
            "- الوقاية:"
            "منوع إعطاء إجابات عامة مثل:"
            "قد يكون من الضروري استخدام علاج كيميائي"
            "إذا لم تجد العلاج في السياق:"
            "→ استنتج أفضل علاج زراعي معروف لهذا المرض.\n"
            "لا تقل للمستخدم أن يستشير مختصًا آخر.\n\nالإجابة:"
        )
    else:
        system = (
            "You are Sania, a specialized agronomist for Sania AgriSmart. "
            "Reply ONLY in the same language as the farmer's question. Be concise and structured. "
            "Do NOT tell the farmer to consult another specialist; you are the specialist and must provide actionable guidance."
        )
        prompt = (
            f"[AGRICULTURAL DATABASE CONTEXT]:\n{context}\n\n"
            f"[FARMER'S QUESTION]: {question}\n\n"
            "Based ONLY on the context above:\n"
            "1. Identify the disease or pest.\n"
            "2. Describe key symptoms.\n"
            "3.3. Provide a PRECISE treatment plan including:"
            "   - Type of treatment (fungicide, insecticide, cultural practice)"
            "   - At least 2 concrete product examples (active ingredients, not vague terms)"
            "   - When to apply (timing: preventive, early infection, curative)"
            "   - Practical field actions (remove infected plants, irrigation control, etc.)"

            "4. Structure your answer EXACTLY like this:"
            "   - Disease:"
            "   - Symptoms:"
            "   - Treatment:"
            "       • Chemical treatment:"
            "       • Cultural practices:"
            "   - Prevention:"
            "5. NEVER give vague answers like:"
            "   a chemical treatment may be necessary"

            "6. If treatment is missing in the context:"
            "    infer the MOST COMMON agronomic treatment based on the identified disease\n"
            "If info is insufficient, DO NOT say generic disclaimers like 'insufficient information'.\n"
            "Instead, provide a concrete best-effort agronomic action plan from available context.\n"
            "Never answer with 'consult a specialist'.\n\n"
            "[EXPERT RESPONSE]:"
        )
    return system, prompt


def _build_greeting_prompt(question: str) -> tuple[str, str]:
    """Retourne (system, user_prompt) pour les salutations."""
    if _is_arabic(question):
        system = "أنت سانيا، مساعدة زراعية خبيرة لمنصة Sania AgriSmart. أجب باللغة العربية فقط."
        prompt = f"المستخدم قال: '{question}'. رحّب به بإيجاز واسأله عن مشكلته الزراعية. (جملتان فقط)"
    else:
        system = (
            "You are Sania, a friendly expert agronomist for Sania AgriSmart. "
            "Always reply in the exact same language as the user."
        )
        prompt = (
            f"The user said: '{question}'. "
            "Greet them warmly as Sania the agronomist expert and ask how you can help with their crops. "
            "(2 sentences max)"
        )
    return system, prompt


def _sanitize_answer(answer: str, question: str, is_arabic: bool) -> str:
    """Nettoie les formulations vagues/non actionnables."""
    lowered = answer.lower()
    blocked_phrases = [
        "insufficient information",
        "not enough information",
        "ne fournit pas suffisamment d'informations",
        "pas suffisamment d'informations",
        "je n'ai pas assez d'informations",
    ]
    if any(p in lowered for p in blocked_phrases):
        if is_arabic:
            return (
                f"بناءً على سؤالك حول: {question}\n"
                "الخطة العملية المقترحة:\n"
                "1) إزالة الأوراق أو الأجزاء المصابة فورًا.\n"
                "2) تحسين التهوية وتقليل رطوبة الأوراق (السقي صباحًا وتجنب رش الماء على الأوراق).\n"
                "3) متابعة الحقل يوميًا وعزل المناطق المصابة مبكرًا.\n"
                "4) تطبيق برنامج وقائي/علاجي بالمبيد المناسب للمحصول والمرض وفق الجرعة المكتوبة على الملصق.\n"
                "5) الوقاية للموسم القادم: دورة زراعية، أصناف مقاومة، ونظافة بقايا المحصول."
            )
        return (
            f"Plan d'action concret pour votre question ({question}) :\n"
            "1) Retirez immédiatement les feuilles/parties fortement atteintes.\n"
            "2) Réduisez l'humidité foliaire (arrosage le matin, éviter d'arroser les feuilles).\n"
            "3) Améliorez l'aération de la parcelle et espacez les plants si possible.\n"
            "4) Appliquez un traitement fongicide/adapté à la culture et à la maladie en respectant strictement l'étiquette.\n"
            "5) Prévention: rotation culturale, surveillance rapprochée, destruction des résidus infectés."
        )
    return answer


def _format_history(history: List[Dict[str, str]], max_turns: int = MAX_HISTORY_TURNS) -> str:
    """Transforme l'historique en texte compact pour le prompt."""
    if not history:
        return ""
    tail = history[-(max_turns * 2):]
    lines = []
    for msg in tail:
        role = "Farmer" if msg["role"] == "user" else "Sania"
        lines.append(f"{role}: {msg['content']}")
    return "\n".join(lines)


def init_rag_conversation_tables() -> None:
    """Crée les tables RAG conversation si absentes."""
    RagConversation.__table__.create(bind=engine, checkfirst=True)
    RagMessage.__table__.create(bind=engine, checkfirst=True)


def _get_or_create_conversation(db: Session, user_id: str, conversation_id: str | None) -> str:
    cid = conversation_id or str(uuid.uuid4())
    conversation = db.query(RagConversation).filter(
        RagConversation.id == cid,
        RagConversation.user_id == user_id,
    ).first()
    if conversation is None:
        conversation = RagConversation(id=cid, user_id=user_id)
        db.add(conversation)
        db.commit()
    return cid


def _append_message(db: Session, conversation_id: str, role: str, content: str) -> None:
    db.add(RagMessage(conversation_id=conversation_id, role=role, content=content))
    db.query(RagConversation).filter(RagConversation.id == conversation_id).update(
        {RagConversation.updated_at: func.now()},
        synchronize_session=False,
    )
    db.commit()


def list_conversations(db: Session, user_id: str) -> List[Dict[str, Any]]:
    """Retourne toutes les conversations d'un utilisateur triées par date décroissante."""
    conversations = (
        db.query(RagConversation)
        .filter(RagConversation.user_id == user_id)
        .order_by(RagConversation.updated_at.desc())
        .all()
    )
    result = []
    for conv in conversations:
        # Trouver le premier message utilisateur pour créer le titre
        first_user_msg = next(
            (m for m in sorted(conv.messages, key=lambda m: m.created_at) if m.role == "user"),
            None
        )
        title = (first_user_msg.content[:40] + "...") if first_user_msg and len(first_user_msg.content) > 40 \
                else (first_user_msg.content if first_user_msg else "Nouvelle discussion")
        result.append({
            "id": conv.id,
            "title": title,
            "updated_at": conv.updated_at.isoformat() if conv.updated_at else conv.created_at.isoformat(),
            "message_count": len(conv.messages),
        })
    return result


def get_conversation_history(db: Session, user_id: str, conversation_id: str) -> List[Dict[str, str]]:
    messages = (
        db.query(RagMessage)
        .join(RagConversation, RagConversation.id == RagMessage.conversation_id)
        .filter(
            RagConversation.user_id == user_id,
            RagConversation.id == conversation_id,
        )
        .order_by(RagMessage.created_at.asc())
        .all()
    )
    return [{"role": m.role, "content": m.content} for m in messages]


def clear_conversation(db: Session, user_id: str, conversation_id: str) -> bool:
    conversation = db.query(RagConversation).filter(
        RagConversation.user_id == user_id,
        RagConversation.id == conversation_id,
    ).first()
    if conversation is None:
        return False
    db.delete(conversation)
    db.commit()
    return True


# ── Query RAG principal ───────────────────────────────────────────────────────
def query_rag(db: Session, question: str, user_id: str, conversation_id: str | None = None) -> Dict[str, Any]:
    """
    Pipeline RAG complet (réponse synchrone).
    Retourne {"answer": str, "sources": list}.
    """
    conv_id = _get_or_create_conversation(db, user_id, conversation_id)
    history = get_conversation_history(db, user_id, conv_id)

    # --- Salutation : bypass RAG ---
    if _is_greeting(question):
        logger.info(f"Greeting détecté : '{question}'")
        system, prompt = _build_greeting_prompt(question)
        try:
            answer = _call_llm(prompt, system=system, max_tokens=120)
        except Exception as e:
            logger.error(f"LLM greeting failed: {e}")
            answer = "Bonjour ! Je suis Sania, votre experte agricole. Comment puis-je vous aider ?"
        _append_message(db, conv_id, "user", question)
        _append_message(db, conv_id, "assistant", answer)
        return {"answer": answer, "sources": [], "conversation_id": conv_id}

    # --- Requête technique : pipeline RAG ---
    # Optimisation arabe : top_k réduit, chunks tronqués plus court
    arabic = _is_arabic(question)
    top_k       = 5          # identique FR et AR — moins = plus rapide
    chunk_limit = 250 if arabic else 400
    max_tokens  = 350 if arabic else 600

    retrieved = _retrieve(question, top_k=top_k)
    if not retrieved:
        return {
            "answer": (
                "La base de connaissances est vide. "
                "Veuillez indexer des documents via l'onglet Base de Connaissances."
            ),
            "sources": [],
        }

    context = "\n\n---\n\n".join(r["content"][:chunk_limit] for r in retrieved)
    history_text = _format_history(history)
    if history_text:
        context = f"[RECENT CONVERSATION]\n{history_text}\n\n[RETRIEVED CONTEXT]\n{context}"
    system, prompt = _build_prompt(question, context)

    try:
        answer = _call_llm(prompt, system=system, max_tokens=max_tokens)
    except Exception as e:
        logger.error(f"LLM RAG call failed: {e}")
        raise RuntimeError(f"Token Factory LLM error: {e}") from e
    answer = _sanitize_answer(answer, question, arabic)

    _append_message(db, conv_id, "user", question)
    _append_message(db, conv_id, "assistant", answer)

    return {
        "answer": answer,
        "conversation_id": conv_id,
        "sources": [
            {
                "rank":     r["rank"],
                "score":    r["score"],
                "source":   r["source"],
                "filename": r["filename"],
                "chunk_id": r["chunk_id"],
            }
            for r in retrieved
        ],
    }


# ── Streaming ─────────────────────────────────────────────────────────────────
def stream_query_rag(question: str) -> Generator[str, None, None]:
    """
    Version streaming de query_rag.
    Yield les tokens texte, puis envoie les sources en fin de stream
    sous la forme : \\n\\n__SOURCES__<json>
    
    Usage FastAPI :
        from fastapi.responses import StreamingResponse
        return StreamingResponse(stream_query_rag(q), media_type="text/plain; charset=utf-8")
    """
    # --- Salutation ---
    if _is_greeting(question):
        system, prompt = _build_greeting_prompt(question)
        yield from _stream_llm(prompt, system=system, max_tokens=120)
        return

    # --- RAG technique ---
    arabic = _is_arabic(question)
    top_k       = 5
    chunk_limit = 250 if arabic else 400
    max_tokens  = 350 if arabic else 600

    retrieved = _retrieve(question, top_k=top_k)
    if not retrieved:
        yield "La base de connaissances est vide. Veuillez indexer des documents."
        return

    context = "\n\n---\n\n".join(r["content"][:chunk_limit] for r in retrieved)
    system, prompt = _build_prompt(question, context)

    yield from _stream_llm(prompt, system=system, max_tokens=max_tokens)

    # Envoyer les sources à la fin (le frontend parse après __SOURCES__)
    sources = [
        {
            "rank":     r["rank"],
            "score":    r["score"],
            "source":   r["source"],
            "filename": r["filename"],
        }
        for r in retrieved
    ]
    yield f"\n\n__SOURCES__{json.dumps(sources, ensure_ascii=False)}"