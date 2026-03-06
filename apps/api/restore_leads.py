from sqlalchemy import create_engine, text

db_url = "postgresql://l2:l2core_local@localhost:5432/l2core"
engine = create_engine(db_url)

with engine.begin() as conn:
    result = conn.execute(text(
        "UPDATE human_review_queue SET status = 'pending' "
        "WHERE status = 'resolved' AND source LIKE :src"
    ), {"src": "whatsapp_%"})
    print(f"Restored {result.rowcount} recently resolved HR items to pending.")
