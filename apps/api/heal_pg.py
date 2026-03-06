import os
from sqlalchemy import create_engine, text

db_url = "postgresql://l2:l2core_local@localhost:5432/l2core"
print(f"Connecting to {db_url}")

engine = create_engine(db_url)

with engine.begin() as conn:
    # Get all pending queues
    pendings = conn.execute(text("SELECT id, source, reference_id, text, created_at FROM human_review_queue WHERE status='pending' ORDER BY created_at ASC")).mappings().all()

    by_phone = {}

    for p in pendings:
        true_phone = None
        if p["source"].startswith("whatsapp_") and p["source"] != "whatsapp_primary_safe_mode":
            true_phone = p["source"].replace("whatsapp_", "")
        elif p["source"] == "whatsapp_primary_safe_mode":
            res = conn.execute(text("SELECT phone FROM inbound_messages WHERE id=:ref"), {"ref": p["reference_id"]}).mappings().fetchone()
            if res and res["phone"]:
                true_phone = res["phone"]
        else:
            if str(p["source"]).replace("+", "").isdigit():
                true_phone = str(p["source"]).replace("+", "")
                
        if true_phone:
            if true_phone not in by_phone:
                by_phone[true_phone] = []
            by_phone[true_phone].append(dict(p))

    print(f"Found {len(by_phone)} distinct phones to merge.")

    # Now, for each phone, merge their texts chronologically
    for phone, items in by_phone.items():
        if len(items) <= 1:
            if items[0]["source"] != f"whatsapp_{phone}":
                conn.execute(text("UPDATE human_review_queue SET source=:s WHERE id=:id"), {"s": f"whatsapp_{phone}", "id": items[0]["id"]})
                print(f"Updated single item {items[0]['id']} to source whatsapp_{phone}")
            continue
        
        # Sort by created_at
        items = sorted(items, key=lambda x: str(x["created_at"]))
        
        # The merged text
        merged_texts = [str(it["text"]) for it in items if it["text"]]
        final_text = "\n".join(merged_texts)
        
        master = items[0]
        latest_time = items[-1]["created_at"]
        
        conn.execute(text("UPDATE human_review_queue SET text=:t, source=:s, created_at=:c WHERE id=:id"), 
                    {"t": final_text, "s": f"whatsapp_{phone}", "c": latest_time, "id": master["id"]})
        
        for other in items[1:]:
            conn.execute(text("DELETE FROM human_review_queue WHERE id=:id"), {"id": other["id"]})

        print(f"Merged {len(items)} items for phone {phone}.")

print("Queue healed successfully.")
