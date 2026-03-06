from sqlalchemy import create_engine, text

db_url = "postgresql://l2:l2core_local@localhost:5432/l2core"
engine = create_engine(db_url)

with engine.begin() as conn:
    # Delete all group/newsletter/broadcast entries from human_review_queue
    result = conn.execute(text("""
        DELETE FROM human_review_queue 
        WHERE source LIKE '%%@g.us%%' 
           OR source LIKE '%%@newsletter%%'
           OR source LIKE '%%@broadcast%%'
    """))
    print(f"Purged {result.rowcount} group/newsletter entries from human_review_queue.")
