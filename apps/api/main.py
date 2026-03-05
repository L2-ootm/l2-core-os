from fastapi import FastAPI, Header, HTTPException, Request, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, MetaData, Table, Column, String, Text
from sqlalchemy.sql import text
from datetime import datetime, timezone, timedelta
from typing import Any
from pathlib import Path
import json
import hmac
import hashlib
import time
import uuid
import jwt
from core.config import settings
from core.ai_fallback import classify_intent

app = FastAPI(title=settings.app_name)
engine = create_engine(settings.database_url, future=True)
metadata = MetaData()

# --- Tables ---
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

entities = Table(
    "entities",
    metadata,
    Column("id", String, primary_key=True),
    Column("type", String, nullable=False),
    Column("full_name", String, nullable=False),
    Column("contact_phone", String, nullable=False),
    Column("updated_at", String, nullable=False),
)

events = Table(
    "events",
    metadata,
    Column("id", String, primary_key=True),
    Column("entity_id", String, nullable=False),
    Column("status", String, nullable=False),
    Column("scheduled_for", String, nullable=True),
    Column("updated_at", String, nullable=False),
)

transactions = Table(
    "transactions",
    metadata,
    Column("id", String, primary_key=True),
    Column("event_id", String, nullable=True),
    Column("amount", String, nullable=False),
    Column("type", String, nullable=False),
    Column("status", String, nullable=False),
    Column("updated_at", String, nullable=False),
)

audit_logs = Table(
    "audit_logs",
    metadata,
    Column("id", String, primary_key=True),
    Column("action", String, nullable=False),
    Column("resource", String, nullable=False),
    Column("resource_id", String, nullable=True),
    Column("details", Text, nullable=False),
    Column("created_at", String, nullable=False),
)

human_review_queue = Table(
    "human_review_queue",
    metadata,
    Column("id", String, primary_key=True),
    Column("source", String, nullable=False),
    Column("reference_id", String, nullable=True),
    Column("text", Text, nullable=True),
    Column("status", String, nullable=False),
    Column("created_at", String, nullable=False),
)

phone_identity = Table(
    "phone_identity",
    metadata,
    Column("phone", String, primary_key=True),
    Column("source", String, nullable=False),
    Column("classification", String, nullable=False),
    Column("entity_id", String, nullable=True),
    Column("last_seen_at", String, nullable=False),
)

service_requests = Table(
    "service_requests",
    metadata,
    Column("id", String, primary_key=True),
    Column("entity_id", String, nullable=True),
    Column("phone", String, nullable=False),
    Column("intent", String, nullable=False),
    Column("status", String, nullable=False),
    Column("notes", Text, nullable=True),
    Column("created_at", String, nullable=False),
)

document_jobs = Table(
    "document_jobs",
    metadata,
    Column("id", String, primary_key=True),
    Column("kind", String, nullable=False),
    Column("status", String, nullable=False),
    Column("output_path", String, nullable=True),
    Column("checksum", String, nullable=True),
    Column("payload", Text, nullable=False),
    Column("created_at", String, nullable=False),
)

# --- Models ---
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


class AITriageRequest(BaseModel):
    text: str
    source: str = "whatsapp"


class AIBlockActionRequest(BaseModel):
    action: str
    text: str = ""
    entity_id: str | None = None
    event_id: str | None = None
    source: str = "whatsapp"


class EntityUpsert(BaseModel):
    id: str
    type: str
    full_name: str
    contact_phone: str


class EventUpsert(BaseModel):
    id: str
    entity_id: str
    status: str
    scheduled_for: str | None = None


class TransactionUpsert(BaseModel):
    id: str
    event_id: str | None = None
    amount: str
    type: str
    status: str


class DocumentGenerateRequest(BaseModel):
    kind: str
    entity_id: str | None = None
    event_id: str | None = None
    title: str
    body: str


# --- Security / Rate limit state ---
rate_ip: dict[str, tuple[int, int]] = {}
rate_token: dict[str, tuple[int, int]] = {}
replay_cache: dict[str, int] = {}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def minute_bucket() -> int:
    return int(time.time() // 60)


def enforce_rate_limit(key: str, limit: int, bucket_map: dict[str, tuple[int, int]]):
    bucket = minute_bucket()
    prev = bucket_map.get(key)
    if not prev or prev[0] != bucket:
        bucket_map[key] = (bucket, 1)
        return
    count = prev[1] + 1
    if count > limit:
        raise HTTPException(status_code=429, detail="rate_limit_exceeded")
    bucket_map[key] = (bucket, count)


@app.middleware("http")
async def global_rate_limit(request: Request, call_next):
    if request.url.path == "/health":
        return await call_next(request)

    ip = request.client.host if request.client else "unknown"
    enforce_rate_limit(f"ip:{ip}", settings.rate_limit_ip_per_min, rate_ip)

    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        token = auth[7:]
        enforce_rate_limit(f"tk:{hashlib.sha256(token.encode()).hexdigest()[:20]}", settings.rate_limit_token_per_min, rate_token)

    return await call_next(request)


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


def get_runtime_whatsapp_policy() -> dict[str, Any]:
    cfg = get_db_settings()
    return {
        "number_mode": str(cfg.get("whatsapp_number_mode", "primary")).lower(),  # dedicated|primary
        "auto_reply_safe_only": bool(cfg.get("auto_reply_only_safe_intents", True)),
        "human_review_default": bool(cfg.get("human_review_default", True)),
        "auto_mark_read": bool(cfg.get("auto_mark_read", False)),
    }


def get_allowed_agenda_phones() -> set[str]:
    cfg = get_db_settings()
    raw = cfg.get("agenda_allowed_phones", [])
    normalized: set[str] = set()
    if isinstance(raw, str):
        raw = [x.strip() for x in raw.split(",") if x.strip()]
    if isinstance(raw, list):
        for p in raw:
            s = str(p).strip()
            if s:
                normalized.add(s)
                normalized.add(s.replace("+", ""))
    return normalized


def classify_phone_source(conn, phone: str) -> dict[str, Any]:
    phone_n = (phone or "").strip()
    phone_n2 = phone_n.replace("+", "")
    agenda = get_allowed_agenda_phones()

    row = conn.execute(text("SELECT id FROM entities WHERE contact_phone IN (:p1,:p2) LIMIT 1"), {"p1": phone_n, "p2": phone_n2}).fetchone()
    entity_id = row[0] if row else None

    in_agenda = phone_n in agenda or phone_n2 in agenda
    if entity_id and in_agenda:
        cls = {"source": "agenda+db", "classification": "known_client", "entity_id": entity_id}
    elif entity_id and not in_agenda:
        cls = {"source": "db", "classification": "known_client", "entity_id": entity_id}
    elif (not entity_id) and in_agenda:
        cls = {"source": "agenda", "classification": "new_lead", "entity_id": None}
    else:
        cls = {"source": "unknown", "classification": "unknown", "entity_id": None}

    conn.execute(
        text(
            """
            INSERT INTO phone_identity (phone, source, classification, entity_id, last_seen_at)
            VALUES (:p,:s,:c,:e,:u)
            ON CONFLICT(phone) DO UPDATE SET
              source=:s, classification=:c, entity_id=:e, last_seen_at=:u
            """
        ),
        {"p": phone_n, "s": cls["source"], "c": cls["classification"], "e": cls["entity_id"], "u": now_iso()},
    )

    return cls


def maybe_create_service_request(conn, entity_id: str | None, phone: str, intent: str, notes: str | None):
    sr_id = str(uuid.uuid4())
    conn.execute(
        service_requests.insert().values(
            id=sr_id,
            entity_id=entity_id,
            phone=phone,
            intent=intent,
            status="open",
            notes=notes,
            created_at=now_iso(),
        )
    )
    return sr_id


def decode_auth_token(auth_header: str | None) -> dict[str, Any]:
    if not auth_header or not auth_header.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="missing_bearer_token")
    token = auth_header[7:]
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algo])
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="invalid_token")


def require_roles(allowed: set[str]):
    def dependency(authorization: str | None = Header(default=None)):
        claims = decode_auth_token(authorization)
        role = str(claims.get("role", "")).lower()
        if role not in allowed:
            raise HTTPException(status_code=403, detail="forbidden")
        return claims

    return dependency


def resolve_entity_and_latest_event_by_phone(conn, phone: str):
    row = conn.execute(
        text("SELECT id FROM entities WHERE contact_phone = :p LIMIT 1"),
        {"p": phone},
    ).fetchone()
    if not row:
        return None, None

    entity_id = row[0]
    event_row = conn.execute(
        text("SELECT id, status FROM events WHERE entity_id = :e ORDER BY updated_at DESC LIMIT 1"),
        {"e": entity_id},
    ).fetchone()

    if not event_row:
        return entity_id, None
    return entity_id, {"id": event_row[0], "status": event_row[1]}


def write_audit(conn, action: str, resource: str, resource_id: str | None, details: dict):
    conn.execute(
        audit_logs.insert().values(
            id=f"{resource}:{resource_id or 'na'}:{int(time.time()*1000)}",
            action=action,
            resource=resource,
            resource_id=resource_id,
            details=json.dumps(details, ensure_ascii=False),
            created_at=now_iso(),
        )
    )


def verify_hmac(body: bytes, ts_header: str | None, sig_header: str | None):
    if not ts_header or not sig_header:
        raise HTTPException(status_code=401, detail="missing_webhook_signature")

    try:
        ts = int(ts_header)
    except ValueError:
        raise HTTPException(status_code=401, detail="invalid_webhook_timestamp")

    now = int(time.time())
    if abs(now - ts) > settings.webhook_replay_window_seconds:
        raise HTTPException(status_code=401, detail="webhook_timestamp_out_of_window")

    signing_payload = f"{ts}.".encode("utf-8") + body
    expected = hmac.new(settings.webhook_hmac_secret.encode("utf-8"), signing_payload, hashlib.sha256).hexdigest()

    if not hmac.compare_digest(expected, sig_header):
        raise HTTPException(status_code=401, detail="invalid_webhook_signature")

    replay_key = f"{ts}:{sig_header}"
    if replay_key in replay_cache:
        raise HTTPException(status_code=409, detail="webhook_replay_detected")

    replay_cache[replay_key] = now

    # prune cache
    cutoff = now - settings.webhook_replay_window_seconds
    stale = [k for k, v in replay_cache.items() if v < cutoff]
    for k in stale:
        replay_cache.pop(k, None)


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


@app.post("/auth/dev-token")
def auth_dev_token(role: str = "owner"):
    # endpoint de bootstrap para ambiente local
    if role not in {"owner", "operator", "viewer"}:
        raise HTTPException(status_code=400, detail="invalid_role")
    exp = datetime.now(timezone.utc) + timedelta(hours=8)
    token = jwt.encode({"role": role, "exp": exp}, settings.jwt_secret, algorithm=settings.jwt_algo)
    return {"ok": True, "token": token, "role": role, "expires_at": exp.isoformat()}


@app.get("/config/schema")
def config_schema(_claims: dict = Depends(require_roles({"owner", "operator", "viewer"}))):
    return {
        "groups": {
            "system": ["APP_ENV", "TIMEZONE"],
            "security": ["RBAC_ENABLED", "RATE_LIMIT_IP_PER_MIN", "RATE_LIMIT_TOKEN_PER_MIN"],
            "whatsapp": [
                "BAILEYS_SESSION_NAME", "BAILEYS_QR_AUTO", "BAILEYS_WEBHOOK_TARGET",
                "whatsapp_number_mode", "auto_mark_read", "auto_reply_only_safe_intents", "human_review_default"
            ],
            "intelligence": ["FEATURE_INTENT_ROUTER", "INTENT_ROUTER_MODEL", "INTENT_CONFIDENCE_THRESHOLD"],
            "mobile": ["MOBILE_SYNC_ENABLED", "MOBILE_SYNC_POLL_SECONDS", "MOBILE_DEVICE_BINDING_REQUIRED"],
        }
    }


@app.get("/config/current")
def config_current(_claims: dict = Depends(require_roles({"owner", "operator", "viewer"}))):
    return {
        "env": {
            "APP_ENV": settings.app_env,
            "APP_NAME": settings.app_name,
            "TIMEZONE": settings.timezone,
            "BAILEYS_SESSION_NAME": settings.baileys_session_name,
        },
        "overrides": get_db_settings(),
        "whatsapp_policy": get_runtime_whatsapp_policy(),
    }


@app.post("/config/validate")
def config_validate(req: ConfigApplyRequest, _claims: dict = Depends(require_roles({"owner", "operator"}))):
    if len(req.settings) == 0:
        raise HTTPException(status_code=400, detail="settings_empty")
    for k, v in req.settings.items():
        if len(k) > 120:
            raise HTTPException(status_code=400, detail=f"invalid_key:{k}")
        if isinstance(v, str) and len(v) > 4000:
            raise HTTPException(status_code=400, detail=f"value_too_large:{k}")
    return {"ok": True, "validated": True, "count": len(req.settings)}


@app.post("/config/apply")
def config_apply(req: ConfigApplyRequest, _claims: dict = Depends(require_roles({"owner"}))):
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
async def whatsapp_inbound(
    request: Request,
    x_webhook_timestamp: str | None = Header(default=None),
    x_webhook_signature: str | None = Header(default=None),
):
    body = await request.body()
    verify_hmac(body, x_webhook_timestamp, x_webhook_signature)

    try:
        payload = InboundMessage.model_validate_json(body)
    except Exception:
        raise HTTPException(status_code=400, detail="invalid_payload")

    normalized = (payload.text or "").strip().lower()
    intent = "other"
    if "confirm" in normalized or "confirmo" in normalized:
        intent = "confirm"
    elif "cancel" in normalized or "cancelo" in normalized:
        intent = "cancel"
    elif "remarc" in normalized or "reagend" in normalized:
        intent = "reschedule"

    status_updated = None
    service_request_id = None
    phone_profile = None

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

        phone_profile = classify_phone_source(conn, payload.phone)
        entity_id, event = resolve_entity_and_latest_event_by_phone(conn, payload.phone)
        policy = get_runtime_whatsapp_policy()

        # Modo número principal: conservador por padrão.
        is_primary_mode = policy.get("number_mode") == "primary"
        safe_intent = intent in {"confirm", "cancel", "reschedule"}

        # Se não está na agenda nem no banco, não automatiza; manda para revisão.
        if phone_profile["classification"] == "unknown":
            conn.execute(
                human_review_queue.insert().values(
                    id=f"hr:{payload.external_message_id}",
                    source="whatsapp_unknown_phone",
                    reference_id=payload.external_message_id,
                    text=payload.text,
                    status="pending",
                    created_at=now_iso(),
                )
            )
            write_audit(conn, "unknown_phone_queued", "inbound_messages", payload.external_message_id, {"phone": payload.phone})
        else:
            next_status = None
            if intent == "confirm":
                next_status = "confirmed"
            elif intent == "cancel":
                next_status = "canceled"
            elif intent == "reschedule":
                next_status = "reschedule_requested"

            # Guardrail: número principal + política safe-only => só automação segura
            if is_primary_mode and policy.get("auto_reply_safe_only", True) and not safe_intent:
                conn.execute(
                    human_review_queue.insert().values(
                        id=f"hr:{payload.external_message_id}",
                        source="whatsapp_primary_safe_mode",
                        reference_id=payload.external_message_id,
                        text=payload.text,
                        status="pending",
                        created_at=now_iso(),
                    )
                )
                write_audit(conn, "primary_safe_mode_queued", "inbound_messages", payload.external_message_id, {"intent": intent})
                return {
                    "ok": True,
                    "deduplicated": False,
                    "external_message_id": payload.external_message_id,
                    "intent": intent,
                    "status_updated": None,
                    "phone_profile": phone_profile,
                    "service_request_id": None,
                    "policy": policy,
                }

            if next_status and event:
                conn.execute(
                    text("UPDATE events SET status = :s, updated_at = :u WHERE id = :id"),
                    {"s": next_status, "u": now_iso(), "id": event["id"]},
                )
                status_updated = {"event_id": event["id"], "from": event["status"], "to": next_status}
                write_audit(conn, "intent_status_update", "events", event["id"], {"intent": intent, "phone": payload.phone})
            else:
                normalized = (payload.text or "").lower()
                wants_new_service = any(k in normalized for k in ["novo serviço", "novo servico", "orçamento", "orcamento", "clareamento", "limpeza"])
                if wants_new_service:
                    service_request_id = maybe_create_service_request(conn, entity_id, payload.phone, "new_service", payload.text)
                    write_audit(conn, "service_request_created", "service_requests", service_request_id, {"phone": payload.phone})
                else:
                    conn.execute(
                        human_review_queue.insert().values(
                            id=f"hr:{payload.external_message_id}",
                            source="whatsapp_inbound",
                            reference_id=payload.external_message_id,
                            text=payload.text,
                            status="pending",
                            created_at=now_iso(),
                        )
                    )
                    write_audit(conn, "human_review_queued", "inbound_messages", payload.external_message_id, {"intent": intent})

    return {
        "ok": True,
        "deduplicated": False,
        "external_message_id": payload.external_message_id,
        "intent": intent,
        "status_updated": status_updated,
        "phone_profile": phone_profile,
        "service_request_id": service_request_id,
    }


@app.get("/mobile/sync/pull")
def mobile_sync_pull(since: str | None = None, _claims: dict = Depends(require_roles({"owner", "operator", "viewer"}))):
    since_value = since or "1970-01-01T00:00:00+00:00"
    with engine.begin() as conn:
        e_rows = conn.execute(text("SELECT id, type, full_name, contact_phone, updated_at FROM entities WHERE updated_at > :s ORDER BY updated_at ASC"), {"s": since_value}).mappings().all()
        ev_rows = conn.execute(text("SELECT id, entity_id, status, scheduled_for, updated_at FROM events WHERE updated_at > :s ORDER BY updated_at ASC"), {"s": since_value}).mappings().all()
        t_rows = conn.execute(text("SELECT id, event_id, amount, type, status, updated_at FROM transactions WHERE updated_at > :s ORDER BY updated_at ASC"), {"s": since_value}).mappings().all()

    return {
        "ok": True,
        "since": since,
        "server_time": now_iso(),
        "changes": {
            "entities": [dict(r) for r in e_rows],
            "events": [dict(r) for r in ev_rows],
            "transactions": [dict(r) for r in t_rows],
        },
    }


@app.post("/mobile/sync/push")
def mobile_sync_push(req: MobilePushRequest, _claims: dict = Depends(require_roles({"owner", "operator"}))):
    row_id = f"{req.device_id}:{req.sync_batch_id}"
    applied = 0
    skipped = 0

    with engine.begin() as conn:
        existing = conn.execute(
            text("SELECT id FROM mobile_sync_log WHERE id = :rid"),
            {"rid": row_id},
        ).fetchone()

        if existing:
            return {
                "ok": True,
                "deduplicated": True,
                "sync_batch_id": req.sync_batch_id,
                "accepted_changes": 0,
                "skipped_changes": len(req.changes),
            }

        for ch in req.changes:
            resource = (ch.resource or "").strip().lower()
            payload = ch.payload or {}
            incoming_updated_at = str(payload.get("updated_at") or now_iso())

            if resource == "entities":
                if not payload.get("id"):
                    skipped += 1
                    continue

                current = conn.execute(text("SELECT updated_at FROM entities WHERE id=:id"), {"id": payload["id"]}).fetchone()
                if current and str(current[0]) >= incoming_updated_at:
                    skipped += 1
                    continue

                conn.execute(text("""
                    INSERT INTO entities (id, type, full_name, contact_phone, updated_at)
                    VALUES (:id,:type,:full_name,:contact_phone,:u)
                    ON CONFLICT(id) DO UPDATE SET
                      type=:type, full_name=:full_name, contact_phone=:contact_phone, updated_at=:u
                """), {
                    "id": payload.get("id"),
                    "type": payload.get("type", "lead"),
                    "full_name": payload.get("full_name", "Unknown"),
                    "contact_phone": payload.get("contact_phone", ""),
                    "u": incoming_updated_at,
                })
                applied += 1
                continue

            if resource == "events":
                if not payload.get("id") or not payload.get("entity_id"):
                    skipped += 1
                    continue

                current = conn.execute(text("SELECT updated_at FROM events WHERE id=:id"), {"id": payload["id"]}).fetchone()
                if current and str(current[0]) >= incoming_updated_at:
                    skipped += 1
                    continue

                conn.execute(text("""
                    INSERT INTO events (id, entity_id, status, scheduled_for, updated_at)
                    VALUES (:id,:entity_id,:status,:scheduled_for,:u)
                    ON CONFLICT(id) DO UPDATE SET
                      entity_id=:entity_id, status=:status, scheduled_for=:scheduled_for, updated_at=:u
                """), {
                    "id": payload.get("id"),
                    "entity_id": payload.get("entity_id"),
                    "status": payload.get("status", "scheduled"),
                    "scheduled_for": payload.get("scheduled_for"),
                    "u": incoming_updated_at,
                })
                applied += 1
                continue

            if resource == "transactions":
                if not payload.get("id"):
                    skipped += 1
                    continue

                current = conn.execute(text("SELECT updated_at FROM transactions WHERE id=:id"), {"id": payload["id"]}).fetchone()
                if current and str(current[0]) >= incoming_updated_at:
                    skipped += 1
                    continue

                conn.execute(text("""
                    INSERT INTO transactions (id, event_id, amount, type, status, updated_at)
                    VALUES (:id,:event_id,:amount,:type,:status,:u)
                    ON CONFLICT(id) DO UPDATE SET
                      event_id=:event_id, amount=:amount, type=:type, status=:status, updated_at=:u
                """), {
                    "id": payload.get("id"),
                    "event_id": payload.get("event_id"),
                    "amount": str(payload.get("amount", "0")),
                    "type": payload.get("type", "income"),
                    "status": payload.get("status", "pending"),
                    "u": incoming_updated_at,
                })
                applied += 1
                continue

            skipped += 1

        conn.execute(
            mobile_sync_log.insert().values(
                id=row_id,
                device_id=req.device_id,
                sync_batch_id=req.sync_batch_id,
                payload=req.model_dump_json(),
                created_at=now_iso(),
            )
        )

    return {
        "ok": True,
        "deduplicated": False,
        "sync_batch_id": req.sync_batch_id,
        "accepted_changes": applied,
        "skipped_changes": skipped,
        "conflict_policy": "last-write-wins-by-updated_at",
    }


@app.post("/entities/upsert")
def entities_upsert(req: EntityUpsert, _claims: dict = Depends(require_roles({"owner", "operator"}))):
    ts = now_iso()
    with engine.begin() as conn:
        conn.execute(text("""
            INSERT INTO entities (id, type, full_name, contact_phone, updated_at)
            VALUES (:id,:type,:full_name,:contact_phone,:u)
            ON CONFLICT(id) DO UPDATE SET
              type=:type, full_name=:full_name, contact_phone=:contact_phone, updated_at=:u
        """), {"id": req.id, "type": req.type, "full_name": req.full_name, "contact_phone": req.contact_phone, "u": ts})
    return {"ok": True, "id": req.id, "updated_at": ts}


@app.post("/events/upsert")
def events_upsert(req: EventUpsert, _claims: dict = Depends(require_roles({"owner", "operator"}))):
    ts = now_iso()
    with engine.begin() as conn:
        conn.execute(text("""
            INSERT INTO events (id, entity_id, status, scheduled_for, updated_at)
            VALUES (:id,:entity_id,:status,:scheduled_for,:u)
            ON CONFLICT(id) DO UPDATE SET
              entity_id=:entity_id, status=:status, scheduled_for=:scheduled_for, updated_at=:u
        """), {"id": req.id, "entity_id": req.entity_id, "status": req.status, "scheduled_for": req.scheduled_for, "u": ts})
    return {"ok": True, "id": req.id, "updated_at": ts}


@app.post("/transactions/upsert")
def transactions_upsert(req: TransactionUpsert, _claims: dict = Depends(require_roles({"owner", "operator"}))):
    ts = now_iso()
    with engine.begin() as conn:
        conn.execute(text("""
            INSERT INTO transactions (id, event_id, amount, type, status, updated_at)
            VALUES (:id,:event_id,:amount,:type,:status,:u)
            ON CONFLICT(id) DO UPDATE SET
              event_id=:event_id, amount=:amount, type=:type, status=:status, updated_at=:u
        """), {"id": req.id, "event_id": req.event_id, "amount": req.amount, "type": req.type, "status": req.status, "u": ts})
    return {"ok": True, "id": req.id, "updated_at": ts}


@app.get("/entities/list")
def entities_list(
    q: str | None = None,
    classification: str | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    _claims: dict = Depends(require_roles({"owner", "operator", "viewer"})),
):
    sql = """
        SELECT e.id, e.type, e.full_name, e.contact_phone, e.updated_at,
               COALESCE(p.classification, 'unknown') AS classification
        FROM entities e
        LEFT JOIN phone_identity p ON (p.phone = e.contact_phone OR p.phone = REPLACE(e.contact_phone,'+',''))
        WHERE 1=1
    """
    params: dict[str, Any] = {"limit": limit}
    if q:
        sql += " AND (LOWER(e.full_name) LIKE :q OR e.contact_phone LIKE :qraw)"
        params["q"] = f"%{q.lower()}%"
        params["qraw"] = f"%{q}%"
    if classification:
        sql += " AND COALESCE(p.classification,'unknown') = :c"
        params["c"] = classification
    sql += " ORDER BY e.updated_at DESC LIMIT :limit"

    with engine.begin() as conn:
        rows = conn.execute(text(sql), params).mappings().all()
    return {"ok": True, "items": [dict(r) for r in rows]}


@app.get("/events/list")
def events_list(
    status: str | None = None,
    limit: int = Query(default=200, ge=1, le=500),
    _claims: dict = Depends(require_roles({"owner", "operator", "viewer"})),
):
    sql = """
        SELECT ev.id, ev.entity_id, ev.status, ev.scheduled_for, ev.updated_at,
               e.full_name, e.contact_phone
        FROM events ev
        LEFT JOIN entities e ON e.id = ev.entity_id
        WHERE 1=1
    """
    params: dict[str, Any] = {"limit": limit}
    if status:
        sql += " AND ev.status = :s"
        params["s"] = status
    sql += " ORDER BY ev.updated_at DESC LIMIT :limit"

    with engine.begin() as conn:
        rows = conn.execute(text(sql), params).mappings().all()
    return {"ok": True, "items": [dict(r) for r in rows]}


@app.get("/transactions/list")
def transactions_list(
    status: str | None = None,
    ttype: str | None = Query(default=None, alias="type"),
    limit: int = Query(default=200, ge=1, le=500),
    _claims: dict = Depends(require_roles({"owner", "operator", "viewer"})),
):
    sql = """
        SELECT t.id, t.event_id, t.amount, t.type, t.status, t.updated_at,
               ev.entity_id, e.full_name
        FROM transactions t
        LEFT JOIN events ev ON ev.id = t.event_id
        LEFT JOIN entities e ON e.id = ev.entity_id
        WHERE 1=1
    """
    params: dict[str, Any] = {"limit": limit}
    if status:
        sql += " AND t.status = :s"
        params["s"] = status
    if ttype:
        sql += " AND t.type = :t"
        params["t"] = ttype
    sql += " ORDER BY t.updated_at DESC LIMIT :limit"

    with engine.begin() as conn:
        rows = conn.execute(text(sql), params).mappings().all()
    return {"ok": True, "items": [dict(r) for r in rows]}


@app.get("/finance/summary")
def finance_summary(_claims: dict = Depends(require_roles({"owner", "operator", "viewer"}))):
    with engine.begin() as conn:
        rows = conn.execute(text("SELECT amount, type, status FROM transactions")).fetchall()

    def to_num(v: Any) -> float:
        try:
            return float(str(v).replace(',', '.'))
        except Exception:
            return 0.0

    income = sum(to_num(r[0]) for r in rows if r[1] == "income")
    expense = sum(to_num(r[0]) for r in rows if r[1] == "expense")
    pending = sum(to_num(r[0]) for r in rows if str(r[2]) == "pending")

    return {
        "ok": True,
        "income_total": round(income, 2),
        "expense_total": round(expense, 2),
        "net_total": round(income - expense, 2),
        "pending_total": round(pending, 2),
        "count": len(rows),
    }


@app.get("/ai/capability/policy")
def ai_capability_policy(_claims: dict = Depends(require_roles({"owner", "operator", "viewer"}))):
    return {
        "tiers": {
            "A": {"ram_gb_min": 16, "mode": "local_llm_7b"},
            "B": {"ram_gb_min": 8, "mode": "local_llm_3b"},
            "C": {"ram_gb_min": 0, "mode": "deterministic_fallback"},
        },
        "slo": {"p95_ms_max": 2500},
    }


@app.post("/ai/triage")
def ai_triage(req: AITriageRequest, _claims: dict = Depends(require_roles({"owner", "operator"}))):
    r = classify_intent(req.text)
    return {
        "ok": True,
        "mode": "deterministic_fallback",
        "intent": r.intent,
        "confidence": r.confidence,
        "route": r.route,
        "source": req.source,
    }


@app.post("/ai/block-action")
def ai_block_action(req: AIBlockActionRequest, _claims: dict = Depends(require_roles({"owner", "operator"}))):
    action = (req.action or "").strip().lower()
    allowed = {"confirm", "cancel", "reschedule", "triage"}
    if action not in allowed:
        raise HTTPException(status_code=400, detail="invalid_action")

    triage = classify_intent(req.text or "")
    next_status = None
    route = triage.route

    if action == "confirm":
        next_status = "confirmed"
    elif action == "cancel":
        next_status = "canceled"
    elif action == "reschedule":
        next_status = "reschedule_requested"
    elif action == "triage":
        route = "human_review"

    updated_event = None
    with engine.begin() as conn:
        target_event_id = req.event_id

        if not target_event_id and req.entity_id:
            row = conn.execute(text("SELECT id FROM events WHERE entity_id=:e ORDER BY updated_at DESC LIMIT 1"), {"e": req.entity_id}).fetchone()
            if row:
                target_event_id = row[0]

        if next_status and target_event_id:
            old = conn.execute(text("SELECT status FROM events WHERE id=:id"), {"id": target_event_id}).fetchone()
            old_status = old[0] if old else None
            conn.execute(text("UPDATE events SET status=:s, updated_at=:u WHERE id=:id"), {"s": next_status, "u": now_iso(), "id": target_event_id})
            updated_event = {"event_id": target_event_id, "from": old_status, "to": next_status}
            write_audit(conn, "ai_block_action", "events", target_event_id, {"action": action, "source": req.source})

        if action == "triage" or route == "human_review":
            qid = f"hr:block:{int(time.time()*1000)}"
            conn.execute(human_review_queue.insert().values(id=qid, source=req.source, reference_id=target_event_id, text=req.text, status="pending", created_at=now_iso()))
            write_audit(conn, "ai_block_triage", "human_review_queue", qid, {"action": action})

    return {
        "ok": True,
        "mode": "functional_blocks",
        "action": action,
        "intent": triage.intent,
        "confidence": triage.confidence,
        "route": route,
        "next_status": next_status,
        "updated_event": updated_event,
    }


@app.get("/ops/inbound/summary")
def inbound_summary(_claims: dict = Depends(require_roles({"owner", "operator", "viewer"}))):
    with engine.begin() as conn:
        total = conn.execute(text("SELECT COUNT(1) FROM inbound_messages")).fetchone()[0]
        unknown = conn.execute(text("SELECT COUNT(1) FROM human_review_queue WHERE status='pending' AND source='whatsapp_unknown_phone'"))
        unknown_count = unknown.fetchone()[0]
        new_leads = conn.execute(text("SELECT COUNT(1) FROM phone_identity WHERE classification='new_lead'"))
        new_leads_count = new_leads.fetchone()[0]
    return {
        "ok": True,
        "inbound_total": total,
        "unknown_pending": unknown_count,
        "new_leads_detected": new_leads_count,
    }


@app.get("/ops/leads/classifications")
def leads_classifications(_claims: dict = Depends(require_roles({"owner", "operator", "viewer"}))):
    with engine.begin() as conn:
        known = conn.execute(text("SELECT COUNT(1) FROM phone_identity WHERE classification='known_client'"))
        new_leads = conn.execute(text("SELECT COUNT(1) FROM phone_identity WHERE classification='new_lead'"))
        unknown = conn.execute(text("SELECT COUNT(1) FROM phone_identity WHERE classification='unknown'"))
        pending_hr = conn.execute(text("SELECT COUNT(1) FROM human_review_queue WHERE status='pending'"))
    return {
        "ok": True,
        "classifications": {
            "known_client": known.fetchone()[0],
            "new_lead": new_leads.fetchone()[0],
            "unknown": unknown.fetchone()[0],
            "human_review_pending": pending_hr.fetchone()[0],
        },
    }


@app.post("/documents/generate")
def documents_generate(req: DocumentGenerateRequest, _claims: dict = Depends(require_roles({"owner", "operator"}))):
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfgen import canvas
    except Exception:
        raise HTTPException(status_code=500, detail="reportlab_not_installed")

    base = Path(__file__).resolve().parent / "generated-docs"
    base.mkdir(parents=True, exist_ok=True)

    doc_id = str(uuid.uuid4())
    filename = f"{req.kind}_{doc_id}.pdf"
    out_path = base / filename

    c = canvas.Canvas(str(out_path), pagesize=A4)
    y = 800
    c.setFont("Helvetica-Bold", 14)
    c.drawString(40, y, req.title)
    y -= 30
    c.setFont("Helvetica", 10)
    for line in (req.body or "").split("\n"):
        c.drawString(40, y, line[:120])
        y -= 14
        if y < 60:
            c.showPage()
            c.setFont("Helvetica", 10)
            y = 800
    c.save()

    checksum = hashlib.sha256(out_path.read_bytes()).hexdigest()

    with engine.begin() as conn:
        conn.execute(
            document_jobs.insert().values(
                id=doc_id,
                kind=req.kind,
                status="generated",
                output_path=str(out_path),
                checksum=checksum,
                payload=req.model_dump_json(),
                created_at=now_iso(),
            )
        )
        write_audit(conn, "document_generated", "document_jobs", doc_id, {"kind": req.kind, "path": str(out_path)})

    return {
        "ok": True,
        "document_id": doc_id,
        "path": str(out_path),
        "sha256": checksum,
    }
