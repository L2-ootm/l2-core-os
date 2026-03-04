from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy import create_engine, MetaData, Table, Column, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import text
from datetime import datetime, timezone
import json
from core.config import settings

app = FastAPI(title=settings.app_name)

engine = create_engine(settings.database_url, future=True)
metadata = MetaData()

# Para manter compatível com SQLite durante dev local, payload é Text JSON serializado.
inbound_messages = Table(
    "inbound_messages",
    metadata,
    Column("id", String, primary_key=True),
    Column("external_message_id", String, unique=True, nullable=False),
    Column("phone", String, nullable=False),
    Column("text", Text, nullable=True),
    Column("payload", Text, nullable=False),
    Column("received_at", String, nullable=False),
)

class InboundMessage(BaseModel):
    external_message_id: str
    phone: str
    text: str | None = None
    timestamp: str | None = None
    raw: dict = {}

@app.on_event("startup")
def startup():
    metadata.create_all(engine)

@app.get("/health")
def health():
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    return {
        "ok": True,
        "service": "api",
        "env": settings.app_env,
        "time": datetime.now(timezone.utc).isoformat(),
    }

@app.post("/webhooks/whatsapp/inbound")
def whatsapp_inbound(payload: InboundMessage, x_internal_token: str | None = Header(default=None)):
    if x_internal_token != settings.baileys_internal_token:
        raise HTTPException(status_code=401, detail="invalid_internal_token")

    with engine.begin() as conn:
        existing = conn.execute(
            text("SELECT id FROM inbound_messages WHERE external_message_id = :mid"),
            {"mid": payload.external_message_id},
        ).fetchone()

        if existing:
            return {"ok": True, "deduplicated": True, "external_message_id": payload.external_message_id}

        conn.execute(
            inbound_messages.insert().values(
                id=payload.external_message_id,
                external_message_id=payload.external_message_id,
                phone=payload.phone,
                text=payload.text,
                payload=json.dumps(payload.raw or {}),
                received_at=payload.timestamp or datetime.now(timezone.utc).isoformat(),
            )
        )

    normalized = (payload.text or "").strip().lower()
    intent = "other"
    if "confirm" in normalized:
        intent = "confirm"
    elif "cancel" in normalized:
        intent = "cancel"
    elif "remarc" in normalized or "reagend" in normalized:
        intent = "reschedule"

    return {
        "ok": True,
        "deduplicated": False,
        "external_message_id": payload.external_message_id,
        "intent": intent,
    }
