import os
import psycopg2

def test_login():
    passwords = ['2580', 'sania_pass', 'sania', 'postgres', 'admin', '1234', '123456']
    databases = ['smartfarm', 'postgres', 'sania_db']
    
    print("Sania - Deep Password Search")
    print("-" * 30)
    
    for dbname in databases:
        print(f"\nChecking database: {dbname}")
        for pw in passwords:
            dsn = f"postgresql://postgres:{pw}@localhost:5432/{dbname}"
            try:
                conn = psycopg2.connect(dsn)
                print(f"  [SUCCESS] -> {pw}")
                conn.close()
                return pw, dbname
            except UnicodeDecodeError:
                # Login failed (French é error)
                print(f"  FAILED: {pw}")
            except Exception as e:
                # Other error (like DB not found)
                print(f"  ERROR: {pw} -> {str(e)[:50]}")
    return None

if __name__ == "__main__":
    test_login()
