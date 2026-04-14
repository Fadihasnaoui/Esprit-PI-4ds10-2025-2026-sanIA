from pydantic_settings import BaseSettings, SettingsConfigDict  # type: ignore
from typing import Optional
import os

class Settings(BaseSettings):
    # Support for .env files - Modern Pydantic V2 config
    model_config = SettingsConfigDict(
        env_file=".env", 
        env_file_encoding='utf-8', 
        extra='ignore',
        case_sensitive=True
    )

    PROJECT_NAME: str = "Sania Smart Agriculture"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Security
    SECRET_KEY: str = "SUPER_SECRET_KEY_DONT_USE_IN_PROD"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8
    ALGORITHM: str = "HS256"
    
    # Databases - if DATABASE_URL is in .env, Pydantic loads it into this field
    # If not, components will be used.
    DATABASE_URL_ENV: Optional[str] = os.getenv("DATABASE_URL")
    
    # Components if DATABASE_URL is not set
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "sania_pass"
    POSTGRES_SERVER: str = "" # Empty defaults to SQLite
    POSTGRES_PORT: str = "5432"
    POSTGRES_DB: str = "sania_db"

    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        # 1. Check if DATABASE_URL is provided (explicit or from .env field)
        url = self.DATABASE_URL_ENV
        
        # 2. Fallback to building from individual components
        if not url and self.POSTGRES_SERVER:
            url = f"postgresql+psycopg2://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
            
        # 3. Last fallback: SQLite
        if not url:
            # Absolute path to the database file in the backend directory
            backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            db_path = os.path.join(backend_dir, "sania_local.db")
            return f"sqlite:///{db_path}"
            
        # 4. Standardize for SQLAlchemy
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+psycopg2://", 1)
        elif url.startswith("postgresql://") and "+psycopg2" not in url:
            url = url.replace("postgresql://", "postgresql+psycopg2://", 1)
            
        return url

    # This field will be the final one used by the app
    DATABASE_URL: str = ""

settings = Settings()
# Update the final internal URL with the computed one
settings.DATABASE_URL = settings.SQLALCHEMY_DATABASE_URI
