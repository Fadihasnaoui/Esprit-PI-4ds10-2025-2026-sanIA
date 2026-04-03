"""
RAG Service — Sania AgriSmart
Knowledge sources: treatment1/detailed_treatments.csv,
                   treatment2/treatment_2.csv,
                   treatment2/*.txt,
                   treatment2/*.pdf
 "answer": "I'm an agricultural assistant for the Sania AgriSmart platform, and I'll be happy to help you with your question.\n\nHowever, I need to clarify that the data provided seems to be related to crop monitoring and weather conditions. It appears to contain information about soil moisture, air temperature, relative humidity, wind speed, rainfall, reference evapotranspiration, and other factors affecting crops. The data does not seem to relate to a specific disease or condition, including Iskra (also known as black measles).\n\nIf you meant to ask about a different topic or provide more context, please feel free to do so, and I'll do my best to assist you.",Vector store    : FAISS (disk-persisted, rebuilt on demand)
LLM             : Llama 3 (8B) via Ollama
"""

from __future__ import annotations

import io
import csv
import logging
import pickle
from pathlib import Path
from typing import List, Dict, Any, Union
import httpx
import numpy as np
from pypdf import PdfReader

from ..core.config import settings

logger = logging.getLogger(__name__)


_index = None
_chunks: List[str] = []
_chunk_metadata: List[Dict[str, Any]] = []
_model = None

DATA_DIR = Path(settings.RAG_DATA_DIR)
INDEX_FILE = DATA_DIR / "vector_index.bin"
METADATA_FILE = DATA_DIR / "metadata.pkl"


class OllamaEmbeddingModel:
    def __init__(self, model_name: str):
        self.model_name = model_name

    def encode(self, texts: Union[str, List[str]], **kwargs) -> List[List[float]]:
        import httpx
        results = []
        if isinstance(texts, str):
            texts = [texts]
            
        batch_size = kwargs.get("batch_size", 64)
        
        with httpx.Client(timeout=120.0) as client:
            for i in range(0, len(texts), batch_size):
                batch = texts[i:i + batch_size]
                try:
                    response = client.post(
                        f"{settings.OLLAMA_BASE_URL}/api/embed",
                        json={
                            "model": self.model_name,
                            "input": batch,
                        }
                    )
                    if response.status_code == 200:
                        data = response.json()
                        if "embeddings" in data:
                            results.extend(data["embeddings"])
                            continue
                    else:
                        logger.warning(f"Batch embed failed with status {response.status_code}: {response.text}")
                except Exception as e:
                    logger.warning(f"Batch embed failed, falling back to single embeddings: {e}")
                
                # Fallback
                for text in batch:
                    response = client.post(
                        f"{settings.OLLAMA_BASE_URL}/api/embeddings",
                        json={
                            "model": self.model_name,
                            "prompt": text,
                        }
                    )
                    if response.status_code != 200:
                        err_msg = f"Ollama HTTP {response.status_code}: {response.text}"
                        logger.error(err_msg)
                        raise RuntimeError(err_msg)
                    
                    data = response.json()
                    results.append(data.get("embedding", []))
                    
        return results

def _get_model():
    global _model
    if _model is None:
        logger.info("Loading embedding model all-MiniLM-L6-v2 …")
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer("all-MiniLM-L6-v2")
        logger.info("Embedding model loaded.")
    return _model



# Text extractors
def _extract_txt(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="ignore")


def _extract_pdf(path: Path) -> str:
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


# Chunking
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


# Index Management (Load/Save/Build)
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


# Query
def _retrieve(question: str, top_k: int = 10) -> List[Dict[str, Any]]:
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
        "merci", "thanks", "au revoir", "bye", "goodbye","slt","bjr","bsr","bjour","bsoir","bonsoir"
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
CRITICAL INSTRUCTION: You MUST respond in the EXACT SAME LANGUAGE as the user's message.
- If the user speaks Arabic, you MUST reply entirely in Arabic.
- If the user speaks French, you MUST reply entirely in French.
Respond warmly and ask how you can help with their farm today. Keep it very short."""
        
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

    prompt = f"""You are an expert agricultural assistant for the Sania AgriSmart platform.

YOUR TASKS:
1. Identify the language of the user's QUESTION.
2. Read the provided CONTEXT (which might be in English).
3. Based ONLY on the CONTEXT, provide the appropriate treatment and recommended practices for the plant disease or symptom mentioned. Translate the relevant information from the CONTEXT into the language of the QUESTION.
4. If the info is not in the CONTEXT, politely state that you do not know based on the provided data. Do NOT guess, and ensure this "I don't know" message is ALSO translated into the language of the QUESTION.

CRITICAL INSTRUCTION ON LANGUAGE:
No matter what language the CONTEXT is in, you MUST reply entirely in the EXACT SAME LANGUAGE as the user's QUESTION.
- If QUESTION is in Arabic -> Your response MUST be 100% in Arabic (e.g., "مرحباً، بناءً على المعلومات...").
- If QUESTION is in French -> Your response MUST be 100% in French (e.g., "Bonjour, d'après les informations...").
- If QUESTION is in English -> Your response MUST be 100% in English (e.g., "Hello, based on the information...").

CONTEXT:
{context}

QUESTION (Please answer in the same language as this question):
{question}

RESPONSE:"""

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