import sqlite3
import os

db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'l2core.db'))
print(f"Connecting to {db_path}...")
conn = sqlite3.connect(db_path)
cur = conn.cursor()

try:
    cur.execute("DELETE FROM entities WHERE full_name LIKE '%est%' OR contact_phone LIKE '%550000000%'")
    cur.execute("DELETE FROM entities WHERE full_name = 'DragTest'")
    conn.commit()
    print("Test leads deleted gracefully via native sqlite3.")
except Exception as e:
    print("Database error:", e)

conn.close()
