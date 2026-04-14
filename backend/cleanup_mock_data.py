
from app.db.session import SessionLocal
from app.models.all_models import NDVIRecord
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("cleanup")

def cleanup():
    db = SessionLocal()
    try:
        count = db.query(NDVIRecord).delete()
        db.commit()
        logger.info(f"Successfully deleted {count} NDVI records (mock data removed).")
        logger.info("Now, your dashboard will only show real satellite data fetched from the API.")
    except Exception as e:
        db.rollback()
        logger.error(f"Cleanup failed: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    cleanup()
