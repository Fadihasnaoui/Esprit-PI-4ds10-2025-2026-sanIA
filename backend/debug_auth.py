import os
import sys

# Add current dir to path
sys.path.append(os.getcwd())

from app.core.security import verify_password, pwd_context
from app.db.session import SessionLocal
from app.models.all_models import User

def debug():
    db = SessionLocal()
    email = "fellah@sania.ai"
    password = "sania123"
    
    print(f"Checking user: {email}")
    user = db.query(User).filter(User.email == email).first()
    
    if not user:
        print("ERROR: User not found in database!")
        return
        
    print(f"User found! ID: {user.id}")
    print(f"Hashed password in DB: {user.password_hash}")
    
    try:
        match = verify_password(password, user.password_hash)
        print(f"Verification result: {match}")
        
        # If it fails, let's see what a fresh hash of sania123 looks like here
        fresh_hash = pwd_context.hash(password)
        print(f"Fresh hash of '{password}': {fresh_hash}")
        print(f"Verify fresh hash: {pwd_context.verify(password, fresh_hash)}")
        
    except Exception as e:
        print(f"Error during verification: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    debug()
