"""
RAG Service — Sania AgriSmart
Knowledge sources: treatment1/detailed_treatments.csv,
                   treatment2/treatment_2.csv,
                   treatment2/*.txt,
                   treatment2/*.pdf
Embedding model : all-MiniLM-L6-v2  (sentence-transformers)
Vector store    : FAISS (disk-persisted, rebuilt on demand)
LLM             : Llama 3 (8B) via Ollama
"""

from __future__ import annotations

import io
import csv
import logging
import pickle
from pathlib import Path
from typing import List, Dict, Any

import httpx
import numpy as np

from ..core.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Lazy-loaded globals (populated when build_index() or load_index() is called)
# ---------------------------------------------------------------------------
_index = None
_chunks: List[str] = []
_chunk_metadata: List[Dict[str, Any]] = []
_model = None

DATA_DIR = Path(settings.RAG_DATA_DIR)
INDEX_FILE = DATA_DIR / "vector_index.bin"
METADATA_FILE = DATA_DIR / "metadata.pkl"


# ---------------------------------------------------------------------------
# Helper: load sentence-transformer model once
# ---------------------------------------------------------------------------
def _get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        logger.info("Loading embedding model all-MiniLM-L6-v2 …")
        _model = SentenceTransformer("all-MiniLM-L6-v2")
        logger.info("Embedding model loaded.")
    return _model


# ---------------------------------------------------------------------------
# Text extractors
# ---------------------------------------------------------------------------
def _extract_txt(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="ignore")


def _extract_pdf(path: Path) -> str:
    from pypdf import PdfReader
    reader = PdfReader(str(path))
    pages = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            pages.append(text)
    return "\n".join(pages)


def _extract_csv(path: Path) -> str:
    lines = []
    try:
        content = path.read_text(encoding="utf-8", errors="ignore")
        reader = csv.DictReader(io.StringIO(content))
        for row in reader:
            parts = [f"{k}: {v}" for k, v in row.items() if v]
            lines.append(" | ".join(parts))
    except Exception as e:
        logger.warning(f"Could not parse CSV {path}: {e}")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Chunking
# ---------------------------------------------------------------------------
def _chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> List[str]:
    words = text.split()
    chunks = []
    start = 0
    while start < len(words):
        end = start + chunk_size
        chunk = " ".join(words[start:end])
        if chunk.strip():
            chunks.append(chunk)
        start += chunk_size - overlap
    return chunks


# ---------------------------------------------------------------------------
# Index Management (Load/Save/Build)
# ---------------------------------------------------------------------------
def build_index() -> int:
    """(Re)builds the FAISS index and saves it to disk."""
    global _index, _chunks, _chunk_metadata

    import faiss

    all_chunks: List[str] = []
    all_metadata: List[Dict[str, Any]] = []

    if not DATA_DIR.exists():
        logger.warning(f"RAG data directory not found: {DATA_DIR}")
        return 0

    for fpath in DATA_DIR.rglob("*"):
        if not fpath.is_file() or fpath in [INDEX_FILE, METADATA_FILE]:
            continue
        
        suffix = fpath.suffix.lower()
        if suffix not in [".pdf", ".txt", ".csv"]:
            continue

        logger.info(f"Ingesting {fpath.name} …")
        try:
            if suffix == ".pdf":
                text = _extract_pdf(fpath)
            elif suffix == ".txt":
                text = _extract_txt(fpath)
            elif suffix == ".csv":
                text = _extract_csv(fpath)
            else:
                continue
            
            chunks = _chunk_text(text)
            for i, chunk in enumerate(chunks):
                all_chunks.append(chunk)
                all_metadata.append({
                    "source": str(fpath.relative_to(DATA_DIR)),
                    "filename": fpath.name,
                    "chunk_id": i,
                    "content": chunk,
                })
            logger.info(f"  → {len(chunks)} chunks")
        except Exception as e:
            logger.error(f"Error ingesting {fpath.name}: {e}")

    if not all_chunks:
        logger.warning("No chunks generated — index is empty.")
        _chunks = []
        _chunk_metadata = []
        _index = None
        return 0

    model = _get_model()
    logger.info(f"Embedding {len(all_chunks)} chunks …")
    embeddings = model.encode(all_chunks, batch_size=64, show_progress_bar=False)
    embeddings = np.array(embeddings, dtype="float32")

    dim = embeddings.shape[1]
    idx = faiss.IndexFlatL2(dim)
    idx.add(embeddings)

    _index = idx
    _chunks = all_chunks
    _chunk_metadata = all_metadata

    # Persist to disk
    try:
        faiss.write_index(idx, str(INDEX_FILE))
        with open(METADATA_FILE, "wb") as f:
            pickle.dump({"chunks": _chunks, "metadata": _chunk_metadata}, f)
        logger.info(f"Index persisted to disk: {INDEX_FILE}")
    except Exception as e:
        logger.error(f"Failed to persist index: {e}")
    
    logger.info(f"FAISS index built: {len(all_chunks)} chunks, dim={dim}")
    return len(all_chunks)


def load_index() -> bool:
    """Loads the FAISS index and metadata from disk if they exist."""
    global _index, _chunks, _chunk_metadata

    if not INDEX_FILE.exists() or not METADATA_FILE.exists():
        logger.info("No persisted RAG index found on disk.")
        return False

    import faiss
    try:
        logger.info(f"Loading RAG index from {INDEX_FILE} …")
        _index = faiss.read_index(str(INDEX_FILE))
        
        with open(METADATA_FILE, "rb") as f:
            data = pickle.load(f)
            _chunks = data["chunks"]
            _chunk_metadata = data["metadata"]
        
        logger.info(f"Index loaded successfully: {len(_chunks)} chunks.")
        return True
    except Exception as e:
        logger.error(f"Error loading persisted index: {e}")
        return False


# ---------------------------------------------------------------------------
# Query
# ---------------------------------------------------------------------------
def _retrieve(question: str, top_k: int = 5) -> List[Dict[str, Any]]:
    """Retrieves top-K chunks, matching against a loaded index."""
    global _index
    
    # Lazy load from disk if not already in memory
    if _index is None:
        if not load_index():
            return []
    
    model = _get_model()
    q_vec = model.encode([question], show_progress_bar=False)
    q_vec = np.array(q_vec, dtype="float32")
    
    distances, indices = _index.search(q_vec, top_k)
    results = []
    for rank, (idx, distance) in enumerate(zip(indices[0], distances[0]), start=1):
        if 0 <= idx < len(_chunks):
            meta = _chunk_metadata[idx]
            results.append({
                "rank": rank,
                "score": float(distance),
                "source": meta["source"],
                "filename": meta["filename"],
                "chunk_id": meta["chunk_id"],
                "content": meta["content"],
            })
    return results


def _is_greeting(text: str) -> bool:
    """Detects if the input is a simple greeting or social chat."""
    greetings = {
        "bonjour", "salut", "hello", "hi", "coucou", "hey",
        "ca va", "ça va", "how are you", "comment vas-tu",
        "merci", "thanks", "au revoir", "bye", "goodbye"
    }
    clean_text = text.lower().strip().replace("?", "").replace("!", "")
    return any(g == clean_text for g in greetings)


def query_rag(question: str) -> Dict[str, Any]:
    """Retrieves context and calls LLM to generate an answer.
    Bypasses retrieval for simple greetings.
    """
    
    # 1. Intent Detection: Greetings & General Chat
    if _is_greeting(question):
        logger.info(f"Greeting detected: '{question}'. Bypassing RAG.")
        prompt = f"""You are a friendly agricultural assistant for the Sania AgriSmart platform.
The user just said: '{question}'. 
Respond warmly, greet them in French, and ask how you can help with their farm today.
Keep it very short."""
        
        try:
            response = httpx.post(
                f"{settings.OLLAMA_BASE_URL}/api/generate",
                json={
                    "model": settings.OLLAMA_MODEL,
                    "prompt": prompt,
                    "stream": False,
                },
                timeout=30.0,
            )
            response.raise_for_status()
            data = response.json()
            return {
                "answer": data.get("response", "").strip(),
                "sources": []
            }
        except Exception as e:
            logger.error(f"Ollama direct generate failed: {e}")
            return {"answer": "Bonjour ! Comment puis-je vous aider ?", "sources": []}

    # 2. Technical Query: Full RAG Pipeline
    retrieved = _retrieve(question, top_k=5)
    
    if not retrieved:
        return {
            "answer": (
                "⚠️ La base de connaissances est vide. "
                "Veuillez indexer des documents via l'onglet Base de Connaissances."
            ),
            "sources": []
        }

    context = "\n\n---\n\n".join([item["content"] for item in retrieved])

    prompt = f"""Vous êtes un assistant agricole expert pour la plateforme Sania AgriSmart.
Utilisez UNIQUEMENT le contexte suivant pour répondre à la question. 
Si la réponse n'est pas dans le contexte, dites-le poliment.

CONTEXTE:
{context}

QUESTION: {question}

REPONSE:"""

    try:
        response = httpx.post(
            f"{settings.OLLAMA_BASE_URL}/api/generate",
            json={
                "model": settings.OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False,
            },
            timeout=120.0,
        )
        response.raise_for_status()
        data = response.json()
        
        return {
            "answer": data.get("response", "").strip(),
            "sources": [
                {
                    "rank": item["rank"],
                    "score": item["score"],
                    "source": item["source"],
                    "filename": item["filename"],
                    "chunk_id": item["chunk_id"],
                }
                for item in retrieved
            ]
        }
    except httpx.HTTPError as e:
        logger.error(f"Ollama request failed: {e}")
        raise RuntimeError(f"Ollama service error: {e}") from e