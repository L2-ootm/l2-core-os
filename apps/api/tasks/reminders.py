from celery import Celery, group
from datetime import datetime, timedelta, timezone
from sqlalchemy import create_engine
from sqlalchemy.sql import text
import uuid, httpx

from core.config import settings

celery_app = Celery(
    "reminders",
    broker=settings.redis_url,
    backend=settings.redis_url,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    beat_schedule={
        "check-pending-reminders-every-5-minutes": {
            "task": "apps.api.tasks.reminders.check_pending_reminders",
            "schedule": 300.0,
        },
        "check-reminder-windows-every-hour": {
            "task": "apps.api.tasks.reminders.check_reminder_windows",
            "schedule": 3600.0,
        },
    },
)

engine = create_engine(settings.database_url)

RETRY_DELAY = 300
MAX_RETRIES = 3


@celery_app.task(
    bind=True,
    max_retries=MAX_RETRIES,
    default_retry_delay=RETRY_DELAY,
)
def send_reminder(self, reminder_id: str):
    with engine.connect() as conn:
        reminder_result = conn.execute(
            text("""
                SELECT r.id, r.entity_id, r.event_id, r.status, r.send_at, r.retries
                FROM reminders r
                WHERE r.id = :reminder_id
            """),
            {"reminder_id": reminder_id}
        ).fetchone()

        if not reminder_result:
            return {"status": "error", "message": "Reminder not found"}

        reminder = dict(reminder_result._mapping)

        if reminder["status"] == "sent":
            return {"status": "skipped", "message": "Already sent"}

        entity_result = conn.execute(
            text("""
                SELECT e.id, e.name, e.phone, e.whatsapp_template_id
                FROM entities e
                WHERE e.id = :entity_id
            """),
            {"entity_id": reminder["entity_id"]}
        ).fetchone()

        if not entity_result:
            return {"status": "error", "message": "Entity not found"}

        entity = dict(entity_result._mapping)

        event_result = conn.execute(
            text("""
                SELECT ev.id, ev.title, ev.description, ev.scheduled_for
                FROM events ev
                WHERE ev.id = :event_id
            """),
            {"event_id": reminder["event_id"]}
        ).fetchone()

        if not event_result:
            return {"status": "error", "message": "Event not found"}

        event = dict(event_result._mapping)

        template_result = conn.execute(
            text("""
                SELECT wt.id, wt.name, wt.content, wt.variables
                FROM whatsapp_templates wt
                WHERE wt.id = :template_id
            """),
            {"template_id": entity["whatsapp_template_id"]}
        ).fetchone()

        if not template_result:
            return {"status": "error", "message": "Template not found"}

        template = dict(template_result._mapping)

        context = {
            "entity_name": entity["name"],
            "event_title": event["title"],
            "event_description": event.get("description", ""),
            "event_date": event["scheduled_for"].strftime("%Y-%m-%d") if event["scheduled_for"] else "",
            "event_time": event["scheduled_for"].strftime("%H:%M") if event["scheduled_for"] else "",
        }

        content = template["content"]
        if template.get("variables"):
            for var in template["variables"]:
                placeholder = f"{{{var}}}"
                if placeholder in content:
                    content = content.replace(
                        placeholder,
                        context.get(var, "")
                    )

        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.post(
                    "http://baileys:8080/outbound/send",
                    json={
                        "phone": entity["phone"],
                        "message": content,
                    },
                    headers={
                        "Authorization": f"Bearer {settings.baileys_internal_token}",
                        "Content-Type": "application/json",
                    },
                )
                response.raise_for_status()
        except Exception as exc:
            current_retries = reminder.get("retries", 0)
            if current_retries >= MAX_RETRIES:
                conn.execute(
                    text("""
                        UPDATE reminders
                        SET status = 'failed', updated_at = :updated_at
                        WHERE id = :reminder_id
                    """),
                    {"reminder_id": reminder_id, "updated_at": datetime.now(timezone.utc)}
                )
                conn.commit()
                return {"status": "error", "message": "Max retries exceeded"}
            conn.execute(
                text("""
                    UPDATE reminders
                    SET retries = :retries, updated_at = :updated_at
                    WHERE id = :reminder_id
                """),
                {"reminder_id": reminder_id, "retries": current_retries + 1, "updated_at": datetime.now(timezone.utc)}
            )
            conn.commit()
            raise self.retry(exc=exc)

        conn.execute(
            text("""
                UPDATE reminders
                SET status = 'sent', sent_at = :sent_at, updated_at = :updated_at
                WHERE id = :reminder_id
            """),
            {
                "reminder_id": reminder_id,
                "sent_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            }
        )
        conn.commit()

        return {"status": "success", "message": "Reminder sent"}


@celery_app.task
def check_pending_reminders() -> int:
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                SELECT r.id
                FROM reminders r
                WHERE r.status = 'pending'
                AND r.send_at <= :now
                LIMIT 100
            """),
            {"now": datetime.now(timezone.utc)}
        ).fetchall()

        reminders = [dict(row._mapping) for row in result]

        if reminders:
            task_group = group(
                send_reminder.s(reminder["id"]) for reminder in reminders
            )
            task_group.apply_async()

        return len(reminders)


@celery_app.task
def check_reminder_windows() -> int:
    with engine.connect() as conn:
        now = datetime.now(timezone.utc)
        window_start = now + timedelta(hours=24)
        window_end = now + timedelta(hours=25)

        events_result = conn.execute(
            text("""
                SELECT ev.id, ev.scheduled_for
                FROM events ev
                WHERE ev.scheduled_for >= :window_start
                AND ev.scheduled_for < :window_end
            """),
            {"window_start": window_start, "window_end": window_end}
        ).fetchall()

        events = [dict(row._mapping) for row in events_result]

        created_count = 0
        for event in events:
            existing = conn.execute(
                text("""
                    SELECT id FROM reminders
                    WHERE event_id = :event_id
                    LIMIT 1
                """),
                {"event_id": event["id"]}
            ).fetchone()

            if existing:
                continue

            reminder_id = str(uuid.uuid4())
            send_at = event["scheduled_for"] - timedelta(hours=24)

            conn.execute(
                text("""
                    INSERT INTO reminders (id, event_id, status, send_at, created_at, updated_at)
                    VALUES (:id, :event_id, 'pending', :send_at, :now, :now)
                """),
                {
                    "id": reminder_id,
                    "event_id": event["id"],
                    "send_at": send_at,
                    "now": datetime.now(timezone.utc),
                }
            )
            created_count += 1

        conn.commit()
        return created_count
