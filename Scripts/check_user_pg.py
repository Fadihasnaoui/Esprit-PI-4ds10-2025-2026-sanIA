from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import sys
import os

# Add backend to path
sys.path.append(os.getcwd())

from backend.app.models.all_models import User
from backend.app.core.config import settings

def check_user_exists(email):
    print(f"Connecting to {settings.DATABASE_URL}...")
    try:
        engine = create_engine(settings.DATABASE_URL)
        SessionLocal = sessionmaker(bind=engine)
        db = SessionLocal()
        user = db.query(User).filter(User.email == email).first()
        if user:
            print(f"User FOUND: {user.email}, Role: {user.role}")
        else:
            print(f"User NOT FOUND: {email}")
        db.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_user_exists("fadihasnaoui11@gmail.com")
