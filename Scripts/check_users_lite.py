import sqlite3
import os

db_files = ['backend/sania_manual_test.db', 'backend/sania_test.db']

for db_file in db_files:
    if os.path.exists(db_file):
        print(f"Checking {db_file}...")
        try:
            conn = sqlite3.connect(db_file)
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users';")
            if cursor.fetchone():
                cursor.execute("SELECT email FROM users;")
                emails = cursor.fetchall()
                for email in emails:
                    print(f"Found user: {email[0]}")
            else:
                print("Table 'users' NOT FOUND.")
            conn.close()
        except Exception as e:
            print(f"Error: {e}")
    else:
        print(f"{db_file} not found.")
