import sqlite3
import uuid
from passlib.context import CryptContext

DB_PATH = 'sania_local.db'
pwd_context = CryptContext(schemes=['pbkdf2_sha256'], deprecated='auto')

def fix():
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # 1. Clear users
        cursor.execute("DELETE FROM users")
        
        # 2. Insert with REAL binary UUID
        u_id = uuid.UUID('22222222-2222-2222-2222-222222222222').bytes
        h = pwd_context.hash('sania123')
        
        cursor.execute(
            "INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)",
            (u_id, 'Fellah', 'fellah@sania.ai', h, 'FARMER')
        )
        
        conn.commit()
        print("Success! User inserted with binary ID.")
        
        # 3. Verify
        cursor.execute("SELECT id, email FROM users")
        row = cursor.fetchone()
        if row:
            print(f"Verified: ID type={type(row[0])}, Email={row[1]}")
        
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    fix()
