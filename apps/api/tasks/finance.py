from celery import Celery
from sqlalchemy import create_engine, text
from datetime import datetime, timezone
import uuid

celery_app = Celery("finance_tasks", broker="redis://redis:6379/0")

engine = create_engine("sqlite:///./l2core.db", future=True)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@celery_app.task(name="finance.process_recurring")
def process_recurring_transactions():
    processed = 0
    created = []
    ts = now_iso()

    with engine.begin() as conn:
        recurrings = conn.execute(
            text("SELECT id, entity_id, amount, type, category, frequency, start_date, end_date, last_created_at FROM recurring_transactions WHERE status = 'active'")
        ).fetchall()

        now_dt = datetime.now(timezone.utc)

        for rec in recurrings:
            rec_id, entity_id, amount, tx_type, category, frequency, start_date, end_date, last_created = rec

            try:
                start_dt = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
            except Exception:
                continue

            if now_dt < start_dt:
                continue

            if end_date:
                try:
                    end_dt = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
                    if now_dt > end_dt:
                        continue
                except Exception:
                    pass

            should_create = False
            if not last_created:
                should_create = now_dt >= start_dt
            else:
                try:
                    last_dt = datetime.fromisoformat(last_created.replace("Z", "+00:00"))
                    if frequency == "daily":
                        should_create = (now_dt - last_dt).days >= 1
                    elif frequency == "weekly":
                        should_create = (now_dt - last_dt).days >= 7
                    elif frequency == "monthly":
                        should_create = (now_dt.year > last_dt.year) or (now_dt.year == last_dt.year and now_dt.month > last_dt.month)
                except Exception:
                    should_create = True

            if should_create:
                tx_id = str(uuid.uuid4())
                conn.execute(
                    text("""
                        INSERT INTO transactions (id, event_id, amount, type, status, updated_at)
                        VALUES (:id, NULL, :amount, :type, 'pending', :updated_at)
                    """),
                    {"id": tx_id, "amount": str(amount), "type": tx_type, "updated_at": ts}
                )
                conn.execute(
                    text("""
                        INSERT INTO finance_entry_meta (tx_id, source_kind, source_origin, entity_id, category, notes, created_at)
                        VALUES (:tx_id, :source_kind, 'recurring', :entity_id, :category, :notes, :created_at)
                    """),
                    {
                        "tx_id": tx_id,
                        "source_kind": "patient" if entity_id else "non_patient",
                        "entity_id": entity_id,
                        "category": category,
                        "notes": f"Auto-created from recurring transaction {rec_id}",
                        "created_at": ts
                    }
                )
                conn.execute(
                    text("UPDATE recurring_transactions SET last_created_at = :last_created, updated_at = :updated WHERE id = :id"),
                    {"last_created": ts, "updated": ts, "id": rec_id}
                )
                processed += 1
                created.append(tx_id)

    return {"processed": processed, "created": created}
