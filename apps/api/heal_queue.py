import sqlite3
import os

db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'l2core.db'))
print(f"Connecting to {db_path}")

conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

# Get all pending queues
cur.execute("SELECT id, source, reference_id, text, created_at FROM human_review_queue WHERE status='pending' ORDER BY created_at ASC")
pendings = cur.fetchall()

by_phone = {}

for p in pendings:
    true_phone = None
    if p["source"].startswith("whatsapp_") and p["source"] != "whatsapp_primary_safe_mode":
        true_phone = p["source"].replace("whatsapp_", "")
    elif p["source"] == "whatsapp_primary_safe_mode":
        # reference_id is external_message_id for primary_safe_mode logs
        cur.execute("SELECT phone FROM inbound_messages WHERE id=?", (p["reference_id"],))
        res = cur.fetchone()
        if res and res["phone"]:
            true_phone = res["phone"]
    else:
        if str(p["source"]).replace("+", "").isdigit():
            true_phone = str(p["source"]).replace("+", "")
            
    if true_phone:
        if true_phone not in by_phone:
            by_phone[true_phone] = []
        by_phone[true_phone].append(p)

print(f"Found {len(by_phone)} distinct phones to merge.")

# Now, for each phone, merge their texts chronologically
for phone, items in by_phone.items():
    if len(items) <= 1:
        # If it was whatsapp_primary_safe_mode, we must update its source anyway
        if items[0]["source"] != f"whatsapp_{phone}":
            cur.execute("UPDATE human_review_queue SET source=? WHERE id=?", (f"whatsapp_{phone}", items[0]["id"]))
            print(f"Updated single item {items[0]['id']} to source whatsapp_{phone}")
        continue
    
    # Sort by created_at
    items = sorted(items, key=lambda x: x["created_at"])
    
    # The merged text
    merged_texts = [it["text"] for it in items if it["text"]]
    final_text = "\n".join(merged_texts)
    
    master = items[0]
    latest_time = items[-1]["created_at"]
    
    cur.execute("UPDATE human_review_queue SET text=?, source=?, created_at=? WHERE id=?", 
                (final_text, f"whatsapp_{phone}", latest_time, master["id"]))
    
    for other in items[1:]:
        cur.execute("DELETE FROM human_review_queue WHERE id=?", (other["id"],))

    print(f"Merged {len(items)} items for phone {phone}.")

conn.commit()
conn.close()
print("Queue healed successfully.")
