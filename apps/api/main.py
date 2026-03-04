from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, MetaData, Table, Column, String, Text
from sqlalchemy.sql import text
from datetime import datetime, timezone
from typing import Any
import json
from core.config import settings

app = FastAPI(title=settings.app_name)
engine = create_engine(settings.database_url, future=True)
metadata = MetaData()

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

app_settings = Table(
    "app_settings",
    metadata,
    Column("key", String, primary_key=True),
    Column("value", Text, nullable=False),
    Column("updated_at", String, nullable=False),
)

mobile_sync_log = Table(
    "mobile_sync_log",
    metadata,
    Column("id", String, primary_key=True),
    Column("device_id", String, nullable=False),
    Column("sync_batch_id", String, nullable=False),
    Column("payload", Text, nullable=False),
    Column("created_at", String, nullable=False),
)


class InboundMessage(BaseModel):
    external_message_id: str
    phone: str
    text: str | None = None
    timestamp: str | None = None
    raw: dict = {}


class ConfigApplyRequest(BaseModel):
    settings: dict[str, Any]


class MobileChange(BaseModel):
    resource: str
    operation: str
    idempotency_key: str
    payload: dict[str, Any]


class MobilePushRequest(BaseModel):
    sync_batch_id: str
    device_id: str
    changes: list[MobileChange] = Field(default_factory=list)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_db_settings() -> dict[str, Any]:
    with engine.begin() as conn:
        rows = conn.execute(text("SELECT key, value FROM app_settings")).fetchall()
    parsed: dict[str, Any] = {}
    for r in rows:
        try:
            parsed[r.key] = json.loads(r.value)
        except Exception:
            parsed[r.key] = r.value
    return parsed


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
        "time": now_iso(),
    }


@app.get("/config/schema")
def config_schema():
    return {
        "groups": {
            "system": ["APP_ENV", "TIMEZONE"],
            "security": ["RBAC_ENABLED", "RATE_LIMIT_IP_PER_MIN", "RATE_LIMIT_TOKEN_PER_MIN"],
            "whatsapp": ["BAILEYS_SESSION_NAME", "BAILEYS_QR_AUTO", "BAILEYS_WEBHOOK_TARGET"],
            "intelligence": ["FEATURE_INTENT_ROUTER", "INTENT_ROUTER_MODEL", "INTENT_CONFIDENCE_THRESHOLD"],
            "mobile": ["MOBILE_SYNC_ENABLED", "MOBILE_SYNC_POLL_SECONDS", "MOBILE_DEVICE_BINDING_REQUIRED"],
        }
    }


@app.get("/config/current")
def config_current():
    return {
        "env": {
            "APP_ENV": settings.app_env,
            "APP_NAME": settings.app_name,
            "TIMEZONE": "America/Sao_Paulo",
            "BAILEYS_SESSION_NAME": "main",
        },
        "overrides": get_db_settings(),
    }


@app.post("/config/validate")
def config_validate(req: ConfigApplyRequest):
    if len(req.settings) == 0:
        raise HTTPException(status_code=400, detail="settings_empty")
    for k, v in req.settings.items():
        if len(k) > 120:
            raise HTTPException(status_code=400, detail=f"invalid_key:{k}")
        if isinstance(v, str) and len(v) > 4000:
            raise HTTPException(status_code=400, detail=f"value_too_large:{k}")
    return {"ok": True, "validated": True, "count": len(req.settings)}


@app.post("/config/apply")
def config_apply(req: ConfigApplyRequest, x_internal_token: str | None = Header(default=None)):
    if x_internal_token != settings.baileys_internal_token:
        raise HTTPException(status_code=401, detail="invalid_internal_token")

    ts = now_iso()
    with engine.begin() as conn:
        for k, v in req.settings.items():
            conn.execute(
                text(
                    """
                    INSERT INTO app_settings (key, value, updated_at)
                    VALUES (:k, :v, :u)
                    ON CONFLICT(key) DO UPDATE SET value = :v, updated_at = :u
                    """
                ),
                {"k": k, "v": json.dumps(v), "u": ts},
            )
    return {"ok": True, "applied": len(req.settings), "updated_at": ts}


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
                received_at=payload.timestamp or now_iso(),
            )
        )

    normalized = (payload.text or "").strip().lower()
    intent = "other"
    if "confirm" in normalized or "confirmo" in normalized:
        intent = "confirm"
    elif "cancel" in normalized or "cancelo" in normalized:
        intent = "cancel"
    elif "remarc" in normalized or "reagend" in normalized:
        intent = "reschedule"

    return {
        "ok": True,
        "deduplicated": False,
        "external_message_id": payload.external_message_id,
        "intent": intent,
    }


@app.get("/mobile/sync/pull")
def mobile_sync_pull(since: str | None = None):
    # placeholder de sync incremental; próximo passo: filtrar por updated_at real de resources
    return {
        "ok": True,
        "since": since,
        "server_time": now_iso(),
        "changes": {
            "entities": [],
            "events": [],
            "transactions": [],
        },
    }


@app.post("/mobile/sync/push")
def mobile_sync_push(req: MobilePushRequest, x_internal_token: str | None = Header(default=None)):
    if x_internal_token != settings.baileys_internal_token:
        raise HTTPException(status_code=401, detail="invalid_internal_token")

    with engine.begin() as conn:
        conn.execute(
            mobile_sync_log.insert().values(
                id=f"{req.device_id}:{req.sync_batch_id}",
                device_id=req.device_id,
                sync_batch_id=req.sync_batch_id,
                payload=req.model_dump_json(),
                created_at=now_iso(),
            )
        )

    return {
        "ok": True,
        "sync_batch_id": req.sync_batch_id,
        "accepted_changes": len(req.changes),
    }
