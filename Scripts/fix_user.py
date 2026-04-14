from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import sys
import os
import uuid

# Add backend to path
sys.path.append(os.getcwd())

from backend.app.models.all_models import User, UserRole
from backend.app.core.config import settings
from backend.app.core.security import get_password_hash

def register_user(email, password, name="Fadi Hasnaoui"):
    print(f"Connecting to {settings.DATABASE_URL}...")
    try:
        engine = create_engine(settings.DATABASE_URL)
        SessionLocal = sessionmaker(bind=engine)
        db = SessionLocal()
        user = db.query(User).filter(User.email == email).first()
        if user:
            print(f"User FOUND: {user.email}. Resetting password to: {password}...")
            user.password_hash = get_password_hash(password)
            db.commit()
            print("Password reset successful.")
        else:
            print(f"User NOT FOUND. Creating one with email: {email} and password: {password}...")
            new_user = User(
                id=uuid.uuid4(),
                email=email,
                name=name,
                password_hash=get_password_hash(password),
                role=UserRole.FARMER,
            )
            db.add(new_user)
            db.commit()
            print("User created successfully.")
        db.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    register_user("fadihasnaoui11@gmail.com", "password123")
