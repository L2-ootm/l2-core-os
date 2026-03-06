import sqlite3
import os

for db_name in ['l2.db', 'apps/api/l2.db', 'l2core.db', 'apps/api/l2core.db']:
    db_path = os.path.abspath(db_name)
    if not os.path.exists(db_path):
        continue
    
    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        cur.execute("DELETE FROM entities WHERE full_name LIKE '%est%' OR contact_phone LIKE '%550000000%'")
        cur.execute("DELETE FROM entities WHERE full_name = 'DragTest'")
        conn.commit()
        conn.close()
        print(f"Purged test leads from {db_path}")
    except Exception as e:
        print(f"Error on {db_path}: {e}")
