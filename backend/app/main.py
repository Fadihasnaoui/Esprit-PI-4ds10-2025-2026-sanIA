# Sania AgriSmart - Server Entry Point (Settings Reloaded)
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.core.config import settings
from app.core import rag_state
from app.db.session import engine, Base
from app.routers import auth, fields, sensors, scans, ndvi, alerts, animals, vra, rag
import app.models.all_models  # noqa: F401 — register models before create_all

logger = logging.getLogger(__name__)


def _init_db() -> None:
    """
    Enable pgvector when available; otherwise start without RAG table (Windows Postgres often
    lacks pgvector binaries — use Docker image pgvector/pgvector or install pgvector).
    """
    vector_ok = True
    rag_state.PGVECTOR_ENABLED = True
    try:
        with engine.begin() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    except Exception as e:
        vector_ok = False
        rag_state.PGVECTOR_ENABLED = False
        _safe = settings.DATABASE_URL
        if _safe and "@" in _safe:
            _safe = "postgresql://***@" + _safe.split("@", 1)[-1]
        logger.warning(
            "PostgreSQL: extension « vector » indisponible — API démarre sans RAG. "
            "DATABASE_URL utilisée: %s | "
            "Vérifiez Docker pgvector sur le port (ex. 5433) et que backend/.env est sauvegardé. "
            "Détail: %s",
            _safe,
            e,
        )

    if vector_ok:
        Base.metadata.create_all(bind=engine)
    else:
        tables = [t for t in Base.metadata.sorted_tables if t.name != "knowledge_chunks"]
        Base.metadata.create_all(bind=engine, tables=tables)

    # Truth from DB (handles wrong URL on first connect or reloader quirks)
    from app.core.rag_state import sync_pgvector_flag

    sync_pgvector_flag()


@asynccontextmanager
async def lifespan(app: FastAPI):
    _init_db()
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    from app.core.rag_state import sync_pgvector_flag

    return {
        "message": "Welcome to Sania AgriSmart API",
        "rag_pgvector": sync_pgvector_flag(),
    }


app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
app.include_router(animals.router, prefix=f"{settings.API_V1_STR}/animals", tags=["livestock"])
app.include_router(scans.router, prefix=f"{settings.API_V1_STR}/scans", tags=["disease"])
app.include_router(fields.router, prefix=f"{settings.API_V1_STR}/fields", tags=["fields"])
app.include_router(ndvi.router, prefix=f"{settings.API_V1_STR}/ndvi", tags=["satellite"])
app.include_router(sensors.router, prefix=f"{settings.API_V1_STR}/sensors", tags=["sensors"])
app.include_router(alerts.router, prefix=f"{settings.API_V1_STR}/alerts", tags=["alerts"])
app.include_router(vra.router, prefix=f"{settings.API_V1_STR}/vra", tags=["satellite-vra"])
app.include_router(rag.router, prefix=f"{settings.API_V1_STR}/rag", tags=["rag"])
