from sqlalchemy import create_engine, text

db_url = "postgresql://l2:l2core_local@localhost:5432/l2core"
engine = create_engine(db_url)

with engine.begin() as conn:
    # Normalize all entity phones: remove '+' prefix so JOIN works with 'whatsapp_' || contact_phone
    result = conn.execute(text("""
        UPDATE entities
        SET contact_phone = REPLACE(contact_phone, '+', '')
        WHERE contact_phone LIKE '+%'
    """))
    print(f"Normalized {result.rowcount} entity phone numbers (removed '+' prefix).")

    # Also normalize phone_identity
    result2 = conn.execute(text("""
        UPDATE phone_identity
        SET phone = REPLACE(phone, '+', '')
        WHERE phone LIKE '+%'
    """))
    print(f"Normalized {result2.rowcount} phone_identity records.")

    # Restore any identified leads that were wrongly resolved
    result3 = conn.execute(text("""
        UPDATE human_review_queue
        SET status = 'pending'
        WHERE status = 'resolved'
          AND source LIKE 'whatsapp_%'
          AND created_at > NOW() - INTERVAL '24 hours'
    """))
    print(f"Restored {result3.rowcount} recently resolved HR items to pending.")
