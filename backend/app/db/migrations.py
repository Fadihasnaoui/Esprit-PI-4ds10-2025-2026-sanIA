"""
Lightweight schema migrations executed at startup.
Each operation runs in its own transaction so one failure never
blocks the others. SQLAlchemy create_all() does not ALTER existing
tables — new columns must be applied here.
"""
import logging
import uuid
from sqlalchemy import text
from sqlalchemy.engine import Engine

logger = logging.getLogger(__name__)


def _add_column(engine: Engine, table: str, column: str, definition: str) -> bool:
    """Add *column* to *table* if it does not exist. Returns True when applied."""
    try:
        with engine.begin() as conn:
            if engine.dialect.name == "sqlite":
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {definition}"))
            else:
                conn.execute(text(
                    f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {column} {definition}"
                ))
        logger.info("Migration applied  : %s.%s", table, column)
        return True
    except Exception as exc:
        msg = str(exc).lower()
        if "already exists" in msg or "duplicate column" in msg:
            return False  # already present — fine
        logger.warning("Migration skipped  : %s.%s — %s", table, column, exc)
        return False


def _backfill_telemetry_ids(engine: Engine) -> None:
    """Populate animal_telemetry.id for rows that have no value yet."""
    try:
        if engine.dialect.name != "sqlite":
            # Use Python UUIDs via a batch update — no extension required
            with engine.begin() as conn:
                rows = conn.execute(
                    text("SELECT ctid FROM animal_telemetry WHERE id IS NULL OR id = ''")
                ).fetchall()
            if rows:
                with engine.begin() as conn:
                    for (ctid,) in rows:
                        conn.execute(
                            text("UPDATE animal_telemetry SET id = :uid WHERE ctid = :ctid"),
                            {"uid": str(uuid.uuid4()), "ctid": ctid},
                        )
                logger.info("Backfilled %d animal_telemetry.id rows.", len(rows))
        else:
            with engine.begin() as conn:
                rows = conn.execute(
                    text("SELECT rowid FROM animal_telemetry WHERE id IS NULL OR id = ''")
                ).fetchall()
            if rows:
                with engine.begin() as conn:
                    for (rowid,) in rows:
                        conn.execute(
                            text("UPDATE animal_telemetry SET id = :uid WHERE rowid = :rid"),
                            {"uid": str(uuid.uuid4()), "rid": rowid},
                        )
                logger.info("Backfilled %d animal_telemetry.id rows (SQLite).", len(rows))
    except Exception as exc:
        logger.warning("Backfill animal_telemetry.id skipped — %s", exc)


def run(engine: Engine) -> None:
    """Apply all pending schema migrations."""
    # --- vaccination_logs ---
    _add_column(engine, "vaccination_logs", "created_at",
                "TIMESTAMP WITH TIME ZONE DEFAULT NOW()" if engine.dialect.name != "sqlite"
                else "DATETIME DEFAULT CURRENT_TIMESTAMP")

    # --- treatment_logs ---
    _add_column(engine, "treatment_logs", "created_at",
                "TIMESTAMP WITH TIME ZONE DEFAULT NOW()" if engine.dialect.name != "sqlite"
                else "DATETIME DEFAULT CURRENT_TIMESTAMP")

    # --- animal_telemetry.id  (new UUID primary-key column) ---
    _add_column(engine, "animal_telemetry", "id", "VARCHAR(36)")
    _backfill_telemetry_ids(engine)
