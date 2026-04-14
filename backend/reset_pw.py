import psycopg2

def reset_password():
    print("Sania - Emergency Password Reset")
    print("-" * 30)
    
    # Try current known password
    pw_to_try = 'sania_pass'
    new_pw = 'admin123' # Choosing a very simple one for them
    
    try:
        # Connect to 'postgres' system database
        conn = psycopg2.connect(
            dbname='postgres',
            user='postgres',
            password=pw_to_try,
            host='127.0.0.1',
            port='5432'
        )
        conn.autocommit = True
        cur = conn.cursor()
        
        print(f"Connected to Postgres. Resetting password to: {new_pw} ...")
        cur.execute(f"ALTER USER postgres WITH PASSWORD '{new_pw}';")
        print("SUCCESS! Password has been reset.")
        
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"ERROR: Could not reset password. {str(e)}")
        return False

if __name__ == "__main__":
    reset_password()
