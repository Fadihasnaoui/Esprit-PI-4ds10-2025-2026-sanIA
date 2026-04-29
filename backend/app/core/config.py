from pathlib import Path
from typing import Optional

# Must run before Settings() so DATABASE_URL is not taken from a stale Windows env (e.g. :5432).
from dotenv import load_dotenv

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(_BACKEND_ROOT / ".env", override=True)

from pydantic import AliasChoices, Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Loads from process env (already filled from backend/.env above) + env_file as fallback.
    """

    model_config = SettingsConfigDict(
        env_file=_BACKEND_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=True,
    )

    PROJECT_NAME: str = "Sania AgriSmart Agriculture"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"

    SECRET_KEY: str = Field(default="SUPER_SECRET_KEY_DONT_USE_IN_PROD")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8
    ALGORITHM: str = "HS256"

    POSTGRES_USER: str = Field(default="postgres")
    POSTGRES_PASSWORD: str = Field(default="sania_pass")
    POSTGRES_SERVER: str = Field(default="localhost")
    POSTGRES_PORT: str = Field(default="5432")
    POSTGRES_DB: str = Field(default="sania_db")
    DATABASE_URL: Optional[str] = Field(default=None)

    MINIO_ENDPOINT: str = Field(default="localhost:9000")
    MINIO_ACCESS_KEY: str = Field(default="minioadmin")
    MINIO_SECRET_KEY: str = Field(default="minioadmin")
    MINIO_BUCKET_IMAGES: str = Field(default="sania-drone-images")
    MINIO_SECURE: bool = Field(default=False)

    OPENAI_API_KEY: Optional[str] = Field(default=None)
    OPENAI_BASE_URL: Optional[str] = Field(default=None)
    LLM_MODEL: str = Field(default="gpt-4o-mini")
    # httpx timeout (seconds) for Token Factory / OpenAI chat & embedding HTTP calls (avoid infinite hang)
    OPENAI_HTTP_TIMEOUT: float = Field(default=300.0)
    # Embeddings: "local" = free CPU (sentence-transformers, no API). "openai" = paid OpenAI API.
    EMBEDDING_BACKEND: str = Field(default="local")
    LOCAL_EMBEDDING_MODEL: str = Field(default="all-MiniLM-L6-v2")
    EMBEDDING_MODEL: str = Field(default="text-embedding-3-small")
    OPENAI_EMBEDDING_API_KEY: Optional[str] = Field(default=None)
    OPENAI_EMBEDDING_BASE_URL: Optional[str] = Field(default=None)
    EMBEDDING_DIMENSION: int = Field(default=384)
    RAG_TOP_K: int = Field(default=8)
    RAG_CHUNK_CHARS: int = Field(default=1200)
    RAG_CHUNK_OVERLAP: int = Field(default=200)
    KNOWLEDGE_FILE_PATH: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("KNOWLEDGE_FILE_PATH", "KNOWLEDGE_PDF_PATH"),
    )
    # Optional: folder with many .pdf / .txt / .md — ingest all (see ingest_directory).
    KNOWLEDGE_DIR_PATH: Optional[str] = Field(default=None)
    RAG_INGEST_SECRET: Optional[str] = Field(default=None)

    MQTT_BROKER_URL: str = Field(default="mqtt://localhost:1883")
    MQTT_TOPIC_SENSORS: str = "sania/sensors/#"

    EOSDA_API_KEY: Optional[str] = Field(default=None)   # from https://api-connect.eos.com (My Account → API Keys)
    AGROMONITORING_API_KEY: Optional[str] = Field(default=None)
    # If False (default), quota/full polygon errors return no fake NDVI — only real API stats are shown as "live".
    # Set True only if you prefer a deterministic placeholder when Agromonitoring returns 413.
    AGROMONITORING_SIMULATE_ON_QUOTA: bool = Field(default=False)
    # NDVI source: planetary_stac = Sentinel-2 L2A via Microsoft Planetary Computer (free STAC + COGs, no Agro key).
    # agromonitoring = legacy OpenWeather Agromonitoring API.
    NDVI_PROVIDER: str = Field(default="eosda")
    # Days to search back for Sentinel-2 scenes (planetary_stac).
    NDVI_STAC_LOOKBACK_DAYS: int = Field(default=120)

    @model_validator(mode="after")
    def _database_url(self) -> "Settings":
        if self.DATABASE_URL:
            return self
        object.__setattr__(
            self,
            "DATABASE_URL",
            f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}",
        )
        return self

    @model_validator(mode="after")
    def _strip_agromonitoring(self) -> "Settings":
        if self.AGROMONITORING_API_KEY:
            object.__setattr__(self, "AGROMONITORING_API_KEY", self.AGROMONITORING_API_KEY.strip() or None)
        return self

    @model_validator(mode="after")
    def _embedding_defaults(self) -> "Settings":
        b = (self.EMBEDDING_BACKEND or "local").strip().lower()
        object.__setattr__(self, "EMBEDDING_BACKEND", b)
        if b == "openai":
            if self.EMBEDDING_DIMENSION == 384:
                object.__setattr__(self, "EMBEDDING_DIMENSION", 1536)
        else:
            object.__setattr__(self, "EMBEDDING_DIMENSION", 384)
        return self


settings = Settings()
