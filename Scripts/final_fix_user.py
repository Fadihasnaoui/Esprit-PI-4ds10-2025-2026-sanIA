import psycopg2
from passlib.context import CryptContext
import uuid

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def fix():
    try:
        conn = psycopg2.connect("postgresql://postgres:admin123@localhost:5432/smartfarm")
        conn.autocommit = True
        cur = conn.cursor()
        
        email = "fadihasnaoui11@gmail.com"
        password = "password123"
        hashed = pwd_context.hash(password)
        
        cur.execute("SELECT id FROM users WHERE email = %s", (email,))
        user = cur.fetchone()
        
        if user:
            print(f"User {email} exists. Updating password...")
            cur.execute("UPDATE users SET password_hash = %s WHERE email = %s", (hashed, email))
        else:
            print(f"User {email} not found. Creating...")
            user_id = str(uuid.uuid4())
            cur.execute(
                "INSERT INTO users (id, name, email, password_hash, role) VALUES (%s, %s, %s, %s, %s)",
                (user_id, "Fadi Hasnaoui", email, hashed, "FARMER")
            )
        
        print("Done.")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    fix()
