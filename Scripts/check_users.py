from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os
import sys

# Add backend to path to import models
sys.path.append(os.getcwd())

from backend.app.models.all_models import User

# Try both potential db files
db_files = ['backend/sania_manual_test.db', 'backend/sania_test.db']

for db_file in db_files:
    if os.path.exists(db_file):
        print(f"Checking {db_file}...")
        engine = create_engine(f"sqlite:///{db_file}")
        SessionLocal = sessionmaker(bind=engine)
        db = SessionLocal()
        users = db.query(User).all()
        for u in users:
            print(f"User: {u.email}, Role: {u.role}")
        db.close()
    else:
        print(f"{db_file} not found.")
