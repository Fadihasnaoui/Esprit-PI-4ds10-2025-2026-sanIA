from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from ..core.config import settings

from sqlalchemy.pool import NullPool

# Pointing to local PostgreSQL (assuming user: postgres, pass: sania_pass, port: 5432)
# The DATABASE_URL is constructed in config.py
is_sqlite = settings.DATABASE_URL.startswith("sqlite")
engine = create_engine(
    settings.DATABASE_URL, 
    connect_args={"check_same_thread": False, "timeout": 30} if is_sqlite else {},
    poolclass=NullPool if is_sqlite else None
)

print(f"📡 DATABASE IN USE: {'SQLite (Local)' if is_sqlite else 'PostgreSQL (Native/Cloud)'}")
print(f"🔗 URL: {settings.DATABASE_URL.split('@')[-1] if not is_sqlite else settings.DATABASE_URL}")

# Enable WAL mode for SQLite to allow concurrent reads+writes
if is_sqlite:
    from sqlalchemy import event
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=30000")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
