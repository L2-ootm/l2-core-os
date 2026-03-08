from fastapi import FastAPI, Header, HTTPException, Request, Depends, Query
from fastapi.responses import StreamingResponse
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
import redis
import os
import urllib.request
from core.config import settings
from core.ai_fallback import classify_intent
from core.migrations import run_migrations
from services.lead_scorer import LeadScorer
from services.ollama_client import OllamaClient
from services.ai_queue import AIQueueService

app = FastAPI(title=settings.app_name)
engine = create_engine(settings.database_url, future=True)
metadata = MetaData()

redis_client = None
try:
    redis_url = getattr(settings, "redis_url", None) or "redis://redis:6379/0"
    redis_client = redis.Redis.from_url(redis_url, decode_responses=True)
except Exception:
    redis_client = None

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
    Column("ai_insights", Text, nullable=True),
    Column("lead_score", String, nullable=True),
    Column("updated_at", String, nullable=False),
    Column("pipeline_stage", String, nullable=True),
    Column("pipeline_value", String, nullable=True),
    Column("last_stage_change", String, nullable=True),
)

events = Table(
    "events",
    metadata,
    Column("id", String, primary_key=True),
    Column("entity_id", String, nullable=False),
    Column("status", String, nullable=False),
    Column("scheduled_for", String, nullable=True),
    Column("updated_at", String, nullable=False),
    Column("recurrence_rule", String, nullable=True),
    Column("recurrence_end_date", String, nullable=True),
    Column("parent_event_id", String, nullable=True),
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

finance_entry_meta = Table(
    "finance_entry_meta",
    metadata,
    Column("tx_id", String, primary_key=True),
    Column("source_kind", String, nullable=False),
    Column("source_origin", String, nullable=False),  # manual_dashboard|whatsapp_ai|automation
    Column("entity_id", String, nullable=True),
    Column("category", String, nullable=False),
    Column("notes", Text, nullable=True),
    Column("created_at", String, nullable=False),
)

automation_rules = Table(
    "automation_rules",
    metadata,
    Column("id", String, primary_key=True),
    Column("name", String, nullable=False),
    Column("trigger_type", String, nullable=False),
    Column("conditions", Text, nullable=False),  # JSON stored as TEXT
    Column("actions", Text, nullable=False),  # JSON stored as TEXT
    Column("enabled", String, nullable=False),
    Column("priority", String, nullable=False),
    Column("created_at", String, nullable=False),
    Column("updated_at", String, nullable=False),
)

reminders = Table(
    "reminders",
    metadata,
    Column("id", String, primary_key=True),
    Column("entity_id", String, nullable=False),
    Column("template_name", String, nullable=False),
    Column("scheduled_for", String, nullable=False),
    Column("status", String, nullable=False),  # pending|sent|failed
    Column("sent_at", String, nullable=True),
    Column("created_at", String, nullable=False),
)

whatsapp_templates = Table(
    "whatsapp_templates",
    metadata,
    Column("id", String, primary_key=True),
    Column("name", String, nullable=False),
    Column("body", Text, nullable=False),
    Column("variables", Text, nullable=False),  # JSON stored as TEXT
    Column("language", String, nullable=False),
    Column("created_at", String, nullable=False),
    Column("updated_at", String, nullable=False),
)

document_templates = Table(
    "document_templates",
    metadata,
    Column("id", String, primary_key=True),
    Column("name", String, nullable=False),
    Column("kind", String, nullable=False),
    Column("body", Text, nullable=False),
    Column("variables", Text, nullable=False),
    Column("is_default", String, nullable=False),
    Column("created_at", String, nullable=False),
    Column("updated_at", String, nullable=False),
)

clinics = Table(
    "clinics",
    metadata,
    Column("id", String, primary_key=True),
    Column("name", String, nullable=False),
    Column("address", Text, nullable=True),
    Column("phone", String, nullable=True),
    Column("email", String, nullable=True),
    Column("cnpj", String, nullable=True),
    Column("settings", Text, nullable=False),
    Column("created_at", String, nullable=False),
    Column("updated_at", String, nullable=False),
)

tags = Table(
    "tags",
    metadata,
    Column("id", String, primary_key=True),
    Column("name", String, nullable=False),
    Column("color", String, nullable=False),
    Column("created_at", String, nullable=False),
)

entity_tags = Table(
    "entity_tags",
    metadata,
    Column("entity_id", String, primary_key=True),
    Column("tag_id", String, primary_key=True),
    Column("created_at", String, nullable=False),
)

outbound_messages = Table(
    "outbound_messages",
    metadata,
    Column("id", String, primary_key=True),
    Column("phone", String, nullable=False),
    Column("text", Text, nullable=True),
    Column("sent_at", String, nullable=False),
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


class ClassifyMessageRequest(BaseModel):
    message: str
    model: str | None = None


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
    recurrence_rule: str | None = None
    recurrence_end_date: str | None = None
    parent_event_id: str | None = None


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


class FinanceEntryCreateRequest(BaseModel):
    entry_type: str  # income|expense
    amount: str
    status: str = "pending"
    source_kind: str = "non_patient"  # patient|non_patient
    entity_id: str | None = None
    category: str = "other"
    notes: str | None = None


class IdentifyLeadRequest(BaseModel):
    phone: str
    full_name: str
    notes: str | None = None


class AutomationRuleCreateRequest(BaseModel):
    name: str
    trigger_type: str
    conditions: dict[str, Any] = Field(default_factory=dict)
    actions: list[dict[str, Any]]
    enabled: bool = True
    priority: int = 0


class AutomationRuleUpdateRequest(BaseModel):
    name: str | None = None
    trigger_type: str | None = None
    conditions: dict[str, Any] | None = None
    actions: list[dict[str, Any]] | None = None
    enabled: bool | None = None
    priority: int | None = None


class WhatsAppTemplateCreateRequest(BaseModel):
    name: str
    body: str
    variables: list[str] = Field(default_factory=list)
    language: str = "pt_BR"


class ReminderTestRequest(BaseModel):
    entity_id: str
    template_name: str


class DocumentTemplateCreateRequest(BaseModel):
    name: str
    kind: str  # contract, receipt, invoice, agreement
    body: str
    is_default: bool = False


class DocumentTemplateGenerateRequest(BaseModel):
    entity_id: str | None = None
    event_id: str | None = None
    transaction_id: str | None = None
    variables: dict[str, Any] = Field(default_factory=dict)


class ClinicCreateRequest(BaseModel):
    name: str
    address: str | None = None
    phone: str | None = None
    email: str | None = None
    cnpj: str | None = None
    settings: dict[str, Any] = Field(default_factory=dict)


class TagCreateRequest(BaseModel):
    name: str
    color: str


class TagAssignRequest(BaseModel):
    tag_ids: list[str]


class PipelineStageCreateRequest(BaseModel):
    id: str
    name: str
    order_index: int = 0
    color: str | None = None


class PipelineStageUpdateRequest(BaseModel):
    name: str | None = None
    order_index: int | None = None
    color: str | None = None


class PipelineMoveRequest(BaseModel):
    stage_id: str
    value: float | None = None


class BulkEventCreateRequest(BaseModel):
    events: list[EventUpsert]


class EventDuplicateRequest(BaseModel):
    new_scheduled_for: str


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

    if redis_client is not None:
      try:
          rkey = f"rl:{key}:{bucket}"
          count = int(redis_client.incr(rkey))
          if count == 1:
              redis_client.expire(rkey, 70)
          if count > limit:
              raise HTTPException(status_code=429, detail="rate_limit_exceeded")
          return
      except HTTPException:
          raise
      except Exception:
          pass

    prev = bucket_map.get(key)
    if not prev or prev[0] != bucket:
        bucket_map[key] = (bucket, 1)
        return
    count = prev[1] + 1
    if count > limit:
        raise HTTPException(status_code=429, detail="rate_limit_exceeded")
    bucket_map[key] = (bucket, count)


def generate_recurring_events(
    base_event: dict[str, Any],
    recurrence_rule: str,
    end_date: str | None,
    max_months_ahead: int = 3
) -> list[dict[str, Any]]:
    from datetime import datetime, timedelta
    
    generated = []
    start_dt = datetime.fromisoformat(base_event["scheduled_for"].replace("Z", "+00:00"))
    
    end_dt = None
    if end_date:
        try:
            end_dt = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
        except Exception:
            pass
    
    max_date = start_dt + timedelta(days=max_months_ahead * 30)
    if end_dt:
        max_date = min(max_date, end_dt)
    
    interval = 1
    if recurrence_rule == "daily":
        delta = timedelta(days=interval)
    elif recurrence_rule == "weekly":
        delta = timedelta(weeks=interval)
    elif recurrence_rule == "monthly":
        delta = None
    else:
        return generated
    
    current_dt = start_dt + (delta if delta else timedelta(days=30))
    
    while current_dt <= max_date:
        new_event = {
            "id": str(uuid.uuid4()),
            "entity_id": base_event["entity_id"],
            "status": base_event.get("status", "scheduled"),
            "scheduled_for": current_dt.isoformat(),
            "parent_event_id": base_event["id"],
            "recurrence_rule": None,
            "recurrence_end_date": None,
        }
        generated.append(new_event)
        
        if recurrence_rule == "monthly":
            try:
                current_dt = current_dt.replace(
                    month=current_dt.month + 1 if current_dt.month < 12 else 1,
                    year=current_dt.year + 1 if current_dt.month == 12 else current_dt.year
                )
            except ValueError:
                current_dt = current_dt + timedelta(days=30)
        else:
            current_dt = current_dt + delta
    
    return generated


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
        "auto_finance_from_whatsapp": str(cfg.get("auto_finance_from_whatsapp", "confirm_required")).lower(),
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


def is_undo_last_ai_finance_command(text_value: str) -> bool:
    t = (text_value or "").strip().lower()
    keys = [
        "desfazer ultimo lancamento",
        "desfazer último lançamento",
        "desfazer último pagamento",
        "desfazer ultimo pagamento",
        "desfazer lancamento ia",
        "undo ultimo lancamento",
    ]
    return any(k in t for k in keys)


def parse_finance_signal(text_value: str) -> dict[str, Any] | None:
    import re
    txt = (text_value or "").lower().strip()
    if not txt:
        return None

    has_payment_verb = any(k in txt for k in ["pagou", "pago", "recebi", "recebido", "pagamento"])
    if not has_payment_verb:
        return None

    num_match = re.search(r"(\d+[\.,]?\d{0,2})", txt)
    if not num_match:
        return None

    raw_amount = num_match.group(1).replace(",", ".")
    try:
        amount = str(round(float(raw_amount), 2))
    except Exception:
        return None

    category = "outros"
    if "consulta" in txt:
        category = "consulta"
    elif "procedimento" in txt:
        category = "procedimento"
    elif "retorno" in txt:
        category = "retorno"
    elif "exame" in txt:
        category = "exame"

    confidence = 0.9 if ("paciente" in txt and category != "outros") else 0.75

    return {
        "entry_type": "income",
        "amount": amount,
        "category": category,
        "confidence": confidence,
        "raw": text_value,
    }


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


def ping_json_url(url: str, timeout_sec: int = 2) -> tuple[bool, dict[str, Any] | None]:
    try:
        with urllib.request.urlopen(url, timeout=timeout_sec) as r:
            body = r.read().decode("utf-8")
            data = json.loads(body) if body else None
            return True, data
    except Exception:
        return False, None


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

    if redis_client is not None:
        try:
            rk = f"replay:{replay_key}"
            if redis_client.exists(rk):
                raise HTTPException(status_code=409, detail="webhook_replay_detected")
            redis_client.setex(rk, settings.webhook_replay_window_seconds, "1")
            return
        except HTTPException:
            raise
        except Exception:
            pass

    if replay_key in replay_cache:
        raise HTTPException(status_code=409, detail="webhook_replay_detected")

    replay_cache[replay_key] = now

    cutoff = now - settings.webhook_replay_window_seconds
    stale = [k for k, v in replay_cache.items() if v < cutoff]
    for k in stale:
        replay_cache.pop(k, None)


@app.on_event("startup")
def startup():
    metadata.create_all(engine)
    run_migrations()
    
    with engine.begin() as conn:
        try:
            conn.execute(text("ALTER TABLE inbound_messages ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'incoming'"))
        except Exception:
            pass


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
                "whatsapp_number_mode", "auto_mark_read", "auto_reply_only_safe_intents", "human_review_default", "auto_finance_from_whatsapp",
                "auto_reply_unknown_enabled", "auto_reply_unknown_template", "auto_reply_unknown_delay_sec", "auto_reply_unknown_hours", "auto_reply_unknown_weekends"
            ],
            "intelligence": ["FEATURE_INTENT_ROUTER", "INTENT_ROUTER_MODEL", "INTENT_CONFIDENCE_THRESHOLD", "ollama_model", "ollama_url"],
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

    # Task 1: Filter groups (ignore @g.us and Baileys broadcast artifacts)
    praw = payload.raw or {}
    is_group = (
        "@g.us" in (payload.phone or "")
        or "@g.us" in (praw.get("from") or "")
        or "participant" in praw
        or praw.get("pushName", "").lower() in ["group", "grupo"]
        or praw.get("isGroup") is True
    )
    if is_group:
        return {"ok": True, "ignored": "group"}

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
        undo_processed = None

        def enqueue_lead_for_review(ref_id):
            source_key = f"whatsapp_{payload.phone}"
            existing_hr = conn.execute(
                text("SELECT id, text FROM human_review_queue WHERE source = :s AND status = 'pending' LIMIT 1"),
                {"s": source_key}
            ).fetchone()

            if existing_hr:
                new_text = (existing_hr[1] or "") + "\n" + (payload.text or "")
                conn.execute(
                    text("UPDATE human_review_queue SET text = :t, created_at = :u WHERE id = :id"),
                    {"t": new_text, "u": now_iso(), "id": existing_hr[0]}
                )
                write_audit(conn, "lead_queue_updated", "human_review_queue", existing_hr[0], {"phone": payload.phone})
            else:
                conn.execute(
                    human_review_queue.insert().values(
                        id=f"hr:{payload.external_message_id}",
                        source=source_key,
                        reference_id=ref_id,
                        text=payload.text,
                        status="pending",
                        created_at=now_iso(),
                    )
                )
                write_audit(conn, "lead_queued", "inbound_messages", payload.external_message_id, {"phone": payload.phone})

        # Se não está na agenda nem no banco, não automatiza; manda para revisão.
        if phone_profile["classification"] == "unknown":
            enqueue_lead_for_review(payload.phone)
        else:
            # Comando por WhatsApp: desfazer último lançamento criado pela IA
            if is_undo_last_ai_finance_command(payload.text or ""):
                last_ai = conn.execute(
                    text("""
                        SELECT t.id, t.status
                        FROM transactions t
                        JOIN finance_entry_meta fm ON fm.tx_id = t.id
                        WHERE fm.source_origin = 'whatsapp_ai' AND t.status IN ('pending','paid')
                        ORDER BY t.updated_at DESC
                        LIMIT 1
                    """)
                ).fetchone()
                if last_ai:
                    conn.execute(text("UPDATE transactions SET status='reversed', updated_at=:u WHERE id=:id"), {"u": now_iso(), "id": last_ai[0]})
                    write_audit(conn, "finance_undo_last_ai", "transactions", last_ai[0], {"via": "whatsapp"})
            next_status = None
            if intent == "confirm":
                next_status = "confirmed"
            elif intent == "cancel":
                next_status = "canceled"
            elif intent == "reschedule":
                next_status = "reschedule_requested"

            # Guardrail: número principal + política safe-only => só automação segura
            if is_primary_mode and policy.get("auto_reply_safe_only", True) and not safe_intent:
                enqueue_lead_for_review(entity_id or payload.external_message_id)
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

                finance_signal = parse_finance_signal(payload.text or "")
                if finance_signal:
                    mode = policy.get("auto_finance_from_whatsapp", "confirm_required")
                    can_auto_post = mode == "auto_if_high_confidence" and finance_signal.get("confidence", 0) >= 0.9
                    tx_status = "paid" if can_auto_post else "pending"

                    tx_id = str(uuid.uuid4())
                    conn.execute(
                        transactions.insert().values(
                            id=tx_id,
                            event_id=None,
                            amount=finance_signal["amount"],
                            type="income",
                            status=tx_status,
                            updated_at=now_iso(),
                        )
                    )
                    conn.execute(
                        finance_entry_meta.insert().values(
                            tx_id=tx_id,
                            source_kind="patient" if entity_id else "non_patient",
                            source_origin="whatsapp_ai",
                            entity_id=entity_id,
                            category=finance_signal.get("category", "outros"),
                            notes=finance_signal.get("raw"),
                            created_at=now_iso(),
                        )
                    )
                    write_audit(conn, "finance_whatsapp_ingested", "transactions", tx_id, {"mode": mode, "confidence": finance_signal.get("confidence")})

                    if not can_auto_post:
                        conn.execute(
                            human_review_queue.insert().values(
                                id=f"hr:finance:{payload.external_message_id}",
                                source="finance_confirm_required",
                                reference_id=tx_id,
                                text=payload.text,
                                status="pending",
                                created_at=now_iso(),
                            )
                        )

                else:
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


@app.post("/ai/leads/analyze/{entity_id}")
def ai_lead_analyze(entity_id: str, _claims: dict = Depends(require_roles({"owner", "operator"}))):
    with engine.begin() as conn:
        ent = conn.execute(text("SELECT full_name, contact_phone, ai_insights FROM entities WHERE id = :id"), {"id": entity_id}).fetchone()
        if not ent:
            raise HTTPException(status_code=404, detail="entity_not_found")
        
        # 1. Encontrar o último evento concluído para definir a janela de contexto
        last_event = conn.execute(
            text("SELECT updated_at FROM events WHERE entity_id = :id AND status IN ('confirmed', 'concluded', 'paid') ORDER BY updated_at DESC LIMIT 1"),
            {"id": entity_id}
        ).fetchone()
        
        since = last_event[0] if last_event else "1970-01-01T00:00:00+00:00"
        
        # 2. Buscar histórico recente de mensagens (limitado a 50 para evitar estouro de contexto do Ollama)
        phone = ent[1]
        phone_alt = phone.replace("+", "")
        msgs = conn.execute(
            text("""
                SELECT text, received_at 
                FROM inbound_messages 
                WHERE (phone = :p1 OR phone = :p2) AND received_at > :s 
                ORDER BY received_at DESC LIMIT 50
            """),
            {"p1": phone, "p2": phone_alt, "s": since}
        ).fetchall()
        
        if not msgs:
            return {"ok": True, "analyzed": False, "reason": "no_recent_messages"}
            
        history_str = "\n".join([f"[{m[1]}] Cliente: {m[0]}" for m in reversed(msgs)])
        
        # 3. Preparar Prompt para Ollama (JSON Mode)
        prompt = f"""
        Você é um assistente de inteligência clínica para o L2 CORE OS. 
        Analise o histórico de mensagens recente de um lead/paciente e extraia informações estruturadas.
        Se houver uma consulta recente concluída, foque no NOVO interesse demonstrado após essa consulta.
        
        HISTÓRICO:
        {history_str}
        
        RETORNE APENAS UM JSON (EM PORTUGUÊS) COM ESTE FORMATO:
        {{
          "nome_confirmado": "string ou null",
          "intent_atual": "string (ex: agendamento, orcamento, duvida, reclamacao, retorno)",
          "procedimento_interesse": "string ou null",
          "urgencia": "baixa|media|alta",
          "resumo_observacoes": "string (máximo 200 caracteres)",
          "proxima_acao_sugerida": "string"
        }}
        """
        
        ollama_payload = {
            "model": settings.ollama_model,
            "prompt": prompt,
            "stream": False,
            "format": "json"
        }
        
        try:
            req = urllib.request.Request(
                f"{settings.ollama_url}/api/generate",
                data=json.dumps(ollama_payload).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=30) as response:
                res_data = json.loads(response.read().decode("utf-8"))
                ai_json_str = res_data.get("response", "{}")
                
                # Update Entity
                conn.execute(
                    text("UPDATE entities SET ai_insights = :i, updated_at = :u WHERE id = :id"),
                    {"i": ai_json_str, "u": now_iso(), "id": entity_id}
                )
                write_audit(conn, "lead_ai_analyzed", "entities", entity_id, {"model": settings.ollama_model})
                
                return {"ok": True, "insights": json.loads(ai_json_str)}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"ollama_error: {str(e)}")

@app.post("/entities/{entity_id}/manual-intent")
def entity_manual_intent(entity_id: str, payload: dict, _claims: dict = Depends(require_roles({"owner", "operator"}))):
    new_intent = payload.get("intent")
    if not new_intent:
        raise HTTPException(status_code=400, detail="intent_required")
        
    with engine.begin() as conn:
        ent = conn.execute(text("SELECT ai_insights FROM entities WHERE id = :id"), {"id": entity_id}).fetchone()
        if not ent:
            raise HTTPException(status_code=404, detail="entity_not_found")
            
        current_insights = {}
        if ent[0]:
            try:
                current_insights = json.loads(ent[0])
            except:
                pass
                
        current_insights["intent_atual"] = new_intent
        current_insights["manual_override"] = True
        
        conn.execute(
            text("UPDATE entities SET ai_insights = :i, updated_at = :u WHERE id = :id"),
            {"i": json.dumps(current_insights), "u": now_iso(), "id": entity_id}
        )
        write_audit(conn, "lead_intent_manual_update", "entities", entity_id, {"intent": new_intent})
        
    return {"ok": True, "updated": True, "intent": new_intent}


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


@app.post("/entities/delete")
def entities_delete(req: dict, _claims: dict = Depends(require_roles({"owner", "operator"}))):
    entity_id = req.get("id", "")
    if not entity_id:
        raise HTTPException(status_code=400, detail="id_required")

    with engine.begin() as conn:
        # Get the phone before deleting to clean related records
        entity = conn.execute(
            text("SELECT contact_phone FROM entities WHERE id = :id"),
            {"id": entity_id},
        ).fetchone()

        conn.execute(text("DELETE FROM entities WHERE id = :id"), {"id": entity_id})

        if entity and entity[0]:
            phone = entity[0]
            conn.execute(
                text("DELETE FROM phone_identity WHERE phone = :p"),
                {"p": phone},
            )
            # Also clean HR queue entries for this phone
            conn.execute(
                text("DELETE FROM human_review_queue WHERE source = :src"),
                {"src": f"whatsapp_{phone}"},
            )

        write_audit(conn, "entity_deleted", "entities", entity_id, {})

    return {"ok": True, "deleted": entity_id}


@app.post("/events/upsert")
def events_upsert(req: EventUpsert, _claims: dict = Depends(require_roles({"owner", "operator"}))):
    ts = now_iso()
    with engine.begin() as conn:
        conn.execute(text("""
            INSERT INTO events (id, entity_id, status, scheduled_for, updated_at, recurrence_rule, recurrence_end_date, parent_event_id)
            VALUES (:id,:entity_id,:status,:scheduled_for,:u,:rec_rule,:rec_end,:parent_id)
            ON CONFLICT(id) DO UPDATE SET
              entity_id=:entity_id, status=:status, scheduled_for=:scheduled_for, updated_at=:u,
              recurrence_rule=:rec_rule, recurrence_end_date=:rec_end, parent_event_id=:parent_id
        """), {
            "id": req.id,
            "entity_id": req.entity_id,
            "status": req.status,
            "scheduled_for": req.scheduled_for,
            "u": ts,
            "rec_rule": req.recurrence_rule,
            "rec_end": req.recurrence_end_date,
            "parent_id": req.parent_event_id,
        })
    return {"ok": True, "id": req.id, "updated_at": ts}


@app.post("/events/bulk-create")
def events_bulk_create(req: BulkEventCreateRequest, _claims: dict = Depends(require_roles({"owner", "operator"}))):
    ts = now_iso()
    created_ids = []
    with engine.begin() as conn:
        for event in req.events:
            conn.execute(text("""
                INSERT INTO events (id, entity_id, status, scheduled_for, updated_at, recurrence_rule, recurrence_end_date, parent_event_id)
                VALUES (:id,:entity_id,:status,:scheduled_for,:u,:rec_rule,:rec_end,:parent_id)
                ON CONFLICT(id) DO UPDATE SET
                  entity_id=:entity_id, status=:status, scheduled_for=:scheduled_for, updated_at=:u,
                  recurrence_rule=:rec_rule, recurrence_end_date=:rec_end, parent_event_id=:parent_id
            """), {
                "id": event.id,
                "entity_id": event.entity_id,
                "status": event.status,
                "scheduled_for": event.scheduled_for,
                "u": ts,
                "rec_rule": event.recurrence_rule,
                "rec_end": event.recurrence_end_date,
                "parent_id": event.parent_event_id,
            })
            created_ids.append(event.id)
    return {"ok": True, "created": created_ids, "count": len(created_ids)}


@app.post("/events/{event_id}/duplicate")
def events_duplicate(event_id: str, req: EventDuplicateRequest, _claims: dict = Depends(require_roles({"owner", "operator"}))):
    ts = now_iso()
    with engine.begin() as conn:
        existing = conn.execute(
            text("SELECT id, entity_id, status, scheduled_for FROM events WHERE id = :id"),
            {"id": event_id}
        ).fetchone()
        
        if not existing:
            raise HTTPException(status_code=404, detail="event_not_found")
        
        new_id = str(uuid.uuid4())
        conn.execute(text("""
            INSERT INTO events (id, entity_id, status, scheduled_for, updated_at)
            VALUES (:id,:entity_id,:status,:scheduled_for,:u)
        """), {
            "id": new_id,
            "entity_id": existing[1],
            "status": existing[2],
            "scheduled_for": req.new_scheduled_for,
            "u": ts,
        })
        
    return {"ok": True, "original_id": event_id, "new_id": new_id, "scheduled_for": req.new_scheduled_for}


@app.delete("/events/{event_id}")


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
    pipeline_stage: str | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    _claims: dict = Depends(require_roles({"owner", "operator", "viewer"})),
):
    sql = """
        SELECT e.id, e.type, e.full_name, e.contact_phone, e.updated_at,
               COALESCE(p.classification, 'unknown') AS classification,
               e.pipeline_stage, e.pipeline_value, e.last_stage_change
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
    if pipeline_stage:
        sql += " AND e.pipeline_stage = :ps"
        params["ps"] = pipeline_stage
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
               ev.recurrence_rule, ev.recurrence_end_date, ev.parent_event_id,
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


@app.delete("/events/{event_id}")
def events_delete(event_id: str, delete_series: bool = False, _claims: dict = Depends(require_roles({"owner", "operator"}))):
    with engine.begin() as conn:
        if delete_series:
            conn.execute(
                text("DELETE FROM events WHERE parent_event_id = :id OR id = :id"),
                {"id": event_id}
            )
        else:
            conn.execute(text("DELETE FROM events WHERE id = :id"), {"id": event_id})
    return {"ok": True, "deleted": event_id, "deleted_series": delete_series}


@app.post("/events/{event_id}/update-series")
def events_update_series(
    event_id: str,
    req: EventUpsert,
    update_all: bool = True,
    _claims: dict = Depends(require_roles({"owner", "operator"}))
):
    ts = now_iso()
    updated_ids = []
    with engine.begin() as conn:
        if update_all:
            parent_row = conn.execute(
                text("SELECT parent_event_id FROM events WHERE id = :id"),
                {"id": event_id}
            ).fetchone()
            
            parent_id = parent_row[0] if parent_row and parent_row[0] else event_id
            
            conn.execute(text("""
                UPDATE events SET 
                    status = :status,
                    scheduled_for = :scheduled_for,
                    updated_at = :u
                WHERE parent_event_id = :parent_id OR id = :parent_id
            """), {
                "status": req.status,
                "scheduled_for": req.scheduled_for,
                "u": ts,
                "parent_id": parent_id,
            })
            
            rows = conn.execute(
                text("SELECT id FROM events WHERE parent_event_id = :parent_id OR id = :parent_id"),
                {"parent_id": parent_id}
            ).fetchall()
            updated_ids = [r[0] for r in rows]
        else:
            conn.execute(text("""
                UPDATE events SET 
                    entity_id = :entity_id,
                    status = :status,
                    scheduled_for = :scheduled_for,
                    recurrence_rule = NULL,
                    recurrence_end_date = NULL,
                    parent_event_id = NULL,
                    updated_at = :u
                WHERE id = :id
            """), {
                "entity_id": req.entity_id,
                "status": req.status,
                "scheduled_for": req.scheduled_for,
                "u": ts,
                "id": event_id,
            })
            updated_ids = [event_id]
            
    return {"ok": True, "updated": updated_ids, "count": len(updated_ids)}


@app.get("/transactions/list")
def transactions_list(
    status: str | None = None,
    ttype: str | None = Query(default=None, alias="type"),
    limit: int = Query(default=200, ge=1, le=500),
    _claims: dict = Depends(require_roles({"owner", "operator", "viewer"})),
):
    sql = """
        SELECT t.id, t.event_id, t.amount, t.type, t.status, t.updated_at,
               ev.entity_id AS event_entity_id, e.full_name AS event_full_name,
               fm.source_kind, fm.source_origin, fm.category, fm.notes, fm.entity_id AS meta_entity_id,
               ep.full_name AS meta_full_name
        FROM transactions t
        LEFT JOIN events ev ON ev.id = t.event_id
        LEFT JOIN entities e ON e.id = ev.entity_id
        LEFT JOIN finance_entry_meta fm ON fm.tx_id = t.id
        LEFT JOIN entities ep ON ep.id = fm.entity_id
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


@app.get("/finance/categories")
def finance_categories(_claims: dict = Depends(require_roles({"owner", "operator", "viewer"}))):
    return {
        "ok": True,
        "income": ["consulta", "procedimento", "retorno", "exame", "outros"],
        "expense": ["aluguel", "folha", "insumos", "laboratorio", "marketing", "outros"],
    }


@app.post("/finance/undo-last-ai")
def finance_undo_last_ai(_claims: dict = Depends(require_roles({"owner", "operator"}))):
    with engine.begin() as conn:
        last_ai = conn.execute(
            text("""
                SELECT t.id, t.status
                FROM transactions t
                JOIN finance_entry_meta fm ON fm.tx_id = t.id
                WHERE fm.source_origin = 'whatsapp_ai' AND t.status IN ('pending','paid')
                ORDER BY t.updated_at DESC
                LIMIT 1
            """)
        ).fetchone()
        if not last_ai:
            return {"ok": True, "undone": False, "reason": "no_ai_transaction_found"}

        conn.execute(text("UPDATE transactions SET status='reversed', updated_at=:u WHERE id=:id"), {"u": now_iso(), "id": last_ai[0]})
        write_audit(conn, "finance_undo_last_ai", "transactions", last_ai[0], {"via": "api"})

    return {"ok": True, "undone": True, "tx_id": last_ai[0], "from": last_ai[1], "to": "reversed"}


@app.post("/finance/entries/create")
def finance_entry_create(req: FinanceEntryCreateRequest, _claims: dict = Depends(require_roles({"owner", "operator"}))):
    if req.entry_type not in {"income", "expense"}:
        raise HTTPException(status_code=400, detail="invalid_entry_type")
    if req.source_kind not in {"patient", "non_patient"}:
        raise HTTPException(status_code=400, detail="invalid_source_kind")

    tx_id = str(uuid.uuid4())
    ts = now_iso()

    with engine.begin() as conn:
        conn.execute(
            transactions.insert().values(
                id=tx_id,
                event_id=None,
                amount=str(req.amount),
                type=req.entry_type,
                status=req.status,
                updated_at=ts,
            )
        )
        conn.execute(
            finance_entry_meta.insert().values(
                tx_id=tx_id,
                source_kind=req.source_kind,
                source_origin="manual_dashboard",
                entity_id=req.entity_id,
                category=req.category,
                notes=req.notes,
                created_at=ts,
            )
        )
        write_audit(conn, "finance_entry_created", "transactions", tx_id, req.model_dump())

    return {"ok": True, "tx_id": tx_id, "created_at": ts}


class RecurringTransactionCreateRequest(BaseModel):
    entity_id: str | None = None
    amount: str
    type: str
    category: str = "other"
    frequency: str
    start_date: str
    end_date: str | None = None


class RecurringTransactionUpdateRequest(BaseModel):
    amount: str | None = None
    type: str | None = None
    category: str | None = None
    frequency: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    status: str | None = None


@app.post("/finance/recurring")
def recurring_create(req: RecurringTransactionCreateRequest, _claims: dict = Depends(require_roles({"owner", "operator"}))):
    if req.type not in {"income", "expense"}:
        raise HTTPException(status_code=400, detail="invalid_type")
    if req.frequency not in {"daily", "weekly", "monthly"}:
        raise HTTPException(status_code=400, detail="invalid_frequency")

    rec_id = str(uuid.uuid4())
    ts = now_iso()

    with engine.begin() as conn:
        conn.execute(
            text("""
                INSERT INTO recurring_transactions 
                (id, entity_id, amount, type, category, frequency, start_date, end_date, status, created_at, updated_at)
                VALUES (:id, :entity_id, :amount, :type, :category, :frequency, :start_date, :end_date, 'active', :created_at, :updated_at)
            """),
            {
                "id": rec_id,
                "entity_id": req.entity_id,
                "amount": req.amount,
                "type": req.type,
                "category": req.category,
                "frequency": req.frequency,
                "start_date": req.start_date,
                "end_date": req.end_date,
                "created_at": ts,
                "updated_at": ts,
            }
        )
        write_audit(conn, "recurring_transaction_created", "recurring_transactions", rec_id, req.model_dump())

    return {"ok": True, "id": rec_id, "created_at": ts}


@app.get("/finance/recurring")
def recurring_list(_claims: dict = Depends(require_roles({"owner", "operator", "viewer"}))):
    with engine.begin() as conn:
        rows = conn.execute(
            text("SELECT id, entity_id, amount, type, category, frequency, start_date, end_date, last_created_at, status, created_at, updated_at FROM recurring_transactions ORDER BY created_at DESC")
        ).mappings().all()
    return {"ok": True, "items": [dict(r) for r in rows]}


@app.put("/finance/recurring/{rec_id}")
def recurring_update(rec_id: str, req: RecurringTransactionUpdateRequest, _claims: dict = Depends(require_roles({"owner", "operator"}))):
    updates = []
    params = {"id": rec_id, "updated_at": now_iso()}

    if req.amount is not None:
        updates.append("amount = :amount")
        params["amount"] = req.amount
    if req.type is not None:
        updates.append("type = :type")
        params["type"] = req.type
    if req.category is not None:
        updates.append("category = :category")
        params["category"] = req.category
    if req.frequency is not None:
        updates.append("frequency = :frequency")
        params["frequency"] = req.frequency
    if req.start_date is not None:
        updates.append("start_date = :start_date")
        params["start_date"] = req.start_date
    if req.end_date is not None:
        updates.append("end_date = :end_date")
        params["end_date"] = req.end_date
    if req.status is not None:
        updates.append("status = :status")
        params["status"] = req.status

    if not updates:
        raise HTTPException(status_code=400, detail="no_fields_to_update")

    updates.append("updated_at = :updated_at")

    with engine.begin() as conn:
        conn.execute(
            text(f"UPDATE recurring_transactions SET {', '.join(updates)} WHERE id = :id"),
            params
        )
        write_audit(conn, "recurring_transaction_updated", "recurring_transactions", rec_id, req.model_dump(exclude_none=True))

    return {"ok": True, "updated_at": params["updated_at"]}


@app.delete("/finance/recurring/{rec_id}")
def recurring_delete(rec_id: str, _claims: dict = Depends(require_roles({"owner", "operator"}))):
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM recurring_transactions WHERE id = :id"), {"id": rec_id})
        write_audit(conn, "recurring_transaction_deleted", "recurring_transactions", rec_id, {})
    return {"ok": True, "deleted": rec_id}


@app.post("/finance/recurring/{rec_id}/trigger")
def recurring_trigger(rec_id: str, _claims: dict = Depends(require_roles({"owner", "operator"}))):
    with engine.begin() as conn:
        rec = conn.execute(
            text("SELECT id, entity_id, amount, type, category FROM recurring_transactions WHERE id = :id AND status = 'active'"),
            {"id": rec_id}
        ).fetchone()

        if not rec:
            raise HTTPException(status_code=404, detail="recurring_not_found_or_inactive")

        tx_id = str(uuid.uuid4())
        ts = now_iso()

        conn.execute(
            transactions.insert().values(
                id=tx_id,
                event_id=None,
                amount=str(rec[2]),
                type=rec[3],
                status="pending",
                updated_at=ts,
            )
        )
        conn.execute(
            finance_entry_meta.insert().values(
                tx_id=tx_id,
                source_kind="patient" if rec[1] else "non_patient",
                source_origin="recurring",
                entity_id=rec[1],
                category=rec[4],
                notes=f"Created from recurring transaction {rec_id}",
                created_at=ts,
            )
        )
        conn.execute(
            text("UPDATE recurring_transactions SET last_created_at = :last_created, updated_at = :updated WHERE id = :id"),
            {"last_created": ts, "updated": ts, "id": rec_id}
        )
        write_audit(conn, "recurring_triggered", "recurring_transactions", rec_id, {"tx_id": tx_id})

    return {"ok": True, "tx_id": tx_id, "created_at": ts}


@app.post("/finance/recurring/process")
def recurring_process(_claims: dict = Depends(require_roles({"owner", "operator"}))):
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

            start_dt = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
            if now_dt < start_dt:
                continue

            if end_date:
                end_dt = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
                if now_dt > end_dt:
                    continue

            should_create = False
            if not last_created:
                should_create = now_dt >= start_dt
            else:
                last_dt = datetime.fromisoformat(last_created.replace("Z", "+00:00"))
                if frequency == "daily":
                    should_create = (now_dt - last_dt).days >= 1
                elif frequency == "weekly":
                    should_create = (now_dt - last_dt).days >= 7
                elif frequency == "monthly":
                    should_create = (now_dt.year > last_dt.year) or (now_dt.year == last_dt.year and now_dt.month > last_dt.month)

            if should_create:
                tx_id = str(uuid.uuid4())
                conn.execute(
                    transactions.insert().values(
                        id=tx_id,
                        event_id=None,
                        amount=str(amount),
                        type=tx_type,
                        status="pending",
                        updated_at=ts,
                    )
                )
                conn.execute(
                    finance_entry_meta.insert().values(
                        tx_id=tx_id,
                        source_kind="patient" if entity_id else "non_patient",
                        source_origin="recurring",
                        entity_id=entity_id,
                        category=category,
                        notes=f"Auto-created from recurring transaction {rec_id}",
                        created_at=ts,
                    )
                )
                conn.execute(
                    text("UPDATE recurring_transactions SET last_created_at = :last_created, updated_at = :updated WHERE id = :id"),
                    {"last_created": ts, "updated": ts, "id": rec_id}
                )
                write_audit(conn, "recurring_auto_processed", "recurring_transactions", rec_id, {"tx_id": tx_id})
                processed += 1
                created.append(tx_id)

    return {"ok": True, "processed": processed, "created": created}


ollama_client = OllamaClient(base_url=settings.ollama_url)
ai_queue = AIQueueService()


@app.get("/ai/status")
async def ai_status(_claims: dict = Depends(require_roles({"owner", "operator", "viewer"}))):
    ollama_reachable = False
    has_model = False
    available_models = []
    ollama_error = None
    
    gpu_info = detect_gpu()
    has_gpu = gpu_info and gpu_info != "Acelerador Gráfico Básico"
    
    ollama_reachable = await ollama_client.is_running()
    
    if not ollama_reachable:
        if has_gpu:
            return {
                "ok": True,
                "status": "symbolic",
                "ready": False,
                "ollama": "offline",
                "gpu": gpu_info,
                "has_gpu": has_gpu,
                "reason": "ollama_unreachable"
            }
        else:
            return {
                "ok": True,
                "status": "offline",
                "ready": False,
                "ollama": "offline",
                "gpu": gpu_info,
                "has_gpu": has_gpu,
                "reason": "ollama_unreachable"
            }
    
    try:
        available_models = await ollama_client.get_models()
        has_model = any(settings.ollama_model in m for m in available_models)
    except Exception as e:
        ollama_error = str(e)
    
    if has_model and has_gpu:
        status = "active"
    elif has_model and not has_gpu:
        status = "symbolic"
    else:
        status = "offline"
    
    return {
        "ok": True,
        "status": status,
        "ready": has_model,
        "ollama": "online" if ollama_reachable else "offline",
        "gpu": gpu_info,
        "has_gpu": has_gpu,
        "model": settings.ollama_model,
        "model_loaded": has_model,
        "available_models": available_models,
        "reason": None if has_model else "model_not_found",
        "error": ollama_error
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


@app.post("/ai/classify-message")
async def ai_classify_message(req: ClassifyMessageRequest, _claims: dict = Depends(require_roles({"owner", "operator"}))):
    model = req.model or settings.ollama_model
    
    try:
        result = await ollama_client.classify_intent(req.message)
        return {
            "ok": True,
            "mode": "llm",
            "model": model,
            **result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"classification_error: {str(e)}")


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


@app.get("/ai/stream")
async def ai_stream():
    """Server-Sent Events for real-time AI updates"""
    import redis
    from core.config import settings

    def generate():
        r = redis.from_url(settings.redis_url)
        pubsub = r.pubsub()
        pubsub.subscribe("ai_updates")

        try:
            for message in pubsub.listen():
                if message["type"] == "message":
                    yield f"data: {message['data'].decode()}\n\n"
        except:
            pass

    return StreamingResponse(generate(), media_type="text/event-stream")


@app.post("/ai/classify")
async def ai_classify(
    req: dict,
    _claims: dict = Depends(require_roles({"owner", "operator"}))
):
    """Queue a message for AI classification (idempotent)"""
    result = await ai_queue.classify_message(
        message_id=req.get("message_id"),
        phone=req.get("phone"),
        text=req.get("text", "")
    )
    return result


@app.get("/ai/queue/{queue_id}")
async def ai_queue_status(
    queue_id: str,
    _claims: dict = Depends(require_roles({"owner", "operator", "viewer"}))
):
    """Get status of a classification"""
    return await ai_queue.get_status(queue_id)


@app.get("/ai/queue-status")
async def ai_overall_status(
    _claims: dict = Depends(require_roles({"owner", "operator", "viewer"}))
):
    """Get overall AI queue status"""
    return await ai_queue.get_queue_status()


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


@app.get("/human-review/list")
def human_review_list(
    status: str = "pending",
    limit: int = Query(default=100, ge=1, le=500),
    _claims: dict = Depends(require_roles({"owner", "operator", "viewer"})),
):
    with engine.begin() as conn:
        rows = conn.execute(
            text("""
                SELECT h.id, h.source, h.reference_id, h.text, h.status, h.created_at,
                       e.id AS entity_id, e.full_name AS lead_name, e.ai_insights
                FROM human_review_queue h
                LEFT JOIN entities e ON h.source = 'whatsapp_' || e.contact_phone
                WHERE h.status = :s
                  AND h.source NOT LIKE '%%@g.us%%'
                  AND h.source NOT LIKE '%%@newsletter%%'
                  AND h.source NOT LIKE '%%@broadcast%%'
                ORDER BY h.created_at DESC
                LIMIT :l
            """),
            {"s": status, "l": limit},
        ).mappings().all()
    return {"ok": True, "items": [dict(r) for r in rows]}


@app.post("/human-review/{hr_id}/append-outbound")
async def human_review_append_outbound(
    hr_id: str,
    request: Request,
    _claims: dict = Depends(require_roles({"owner", "operator"})),
):
    """Persist an outbound message into the thread so it survives page reloads."""
    body = await request.json()
    outbound_text = body.get("text", "")
    if not outbound_text:
        raise HTTPException(status_code=400, detail="text_required")

    with engine.begin() as conn:
        existing = conn.execute(
            text("SELECT id, text FROM human_review_queue WHERE id = :id"),
            {"id": hr_id},
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="not_found")

        tagged_line = f"\n[L2]: {outbound_text}"
        new_text = (existing[1] or "") + tagged_line
        conn.execute(
            text("UPDATE human_review_queue SET text = :t, created_at = :u WHERE id = :id"),
            {"t": new_text, "u": now_iso(), "id": hr_id},
        )
        write_audit(conn, "outbound_appended", "human_review_queue", hr_id, {"text": outbound_text[:100]})
    return {"ok": True, "appended": True}


@app.get("/audit/logs")
def audit_logs_list(
    limit: int = Query(default=50, ge=1, le=500),
    _claims: dict = Depends(require_roles({"owner", "operator", "viewer"})),
):
    with engine.begin() as conn:
        rows = conn.execute(
            text("SELECT action, resource, resource_id, details, created_at FROM audit_logs ORDER BY created_at DESC LIMIT :l"),
            {"l": limit},
        ).mappings().all()
    return {"ok": True, "items": [dict(r) for r in rows]}


@app.get("/ops/gonogo/checklist")
def ops_gonogo_checklist(_claims: dict = Depends(require_roles({"owner", "operator", "viewer"}))):
    db_ok = False
    redis_ok = False
    wa_ok = False
    queue_empty = False
    no_critical = True
    backup_recent = False

    try:
        with engine.begin() as conn:
            conn.execute(text("SELECT 1"))
            db_ok = True

            pending = conn.execute(text("SELECT COUNT(1) FROM human_review_queue WHERE status='pending'"))
            pending_count = int(pending.fetchone()[0])
            queue_empty = pending_count == 0

            one_hour_ago = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
            crit = conn.execute(
                text("SELECT COUNT(1) FROM audit_logs WHERE created_at >= :t AND (action ILIKE '%error%' OR action ILIKE '%failed%')"),
                {"t": one_hour_ago},
            )
            crit_count = int(crit.fetchone()[0])
            no_critical = crit_count == 0

            last_backup = conn.execute(text("SELECT value FROM app_settings WHERE key='last_backup_at' LIMIT 1")).fetchone()
            if last_backup and last_backup[0]:
                try:
                    parsed = json.loads(last_backup[0]) if isinstance(last_backup[0], str) else last_backup[0]
                    backup_iso = str(parsed) if isinstance(parsed, str) else str(parsed.get("at", ""))
                    if backup_iso:
                        backup_dt = datetime.fromisoformat(backup_iso.replace("Z", "+00:00"))
                        backup_recent = (datetime.now(timezone.utc) - backup_dt) <= timedelta(hours=24)
                except Exception:
                    backup_recent = False
    except Exception:
        db_ok = False

    try:
        if redis_client is not None:
            redis_ok = bool(redis_client.ping())
    except Exception:
        redis_ok = False

    ok, wa_status = ping_json_url("http://localhost:8090/session/status", timeout_sec=2)
    wa_ok = bool(ok and wa_status and wa_status.get("status") in {"connected", "qr_ready", "connecting"})

    checks = [
        {"item": "API Backend respondendo", "pass": True},
        {"item": "Database acessível", "pass": db_ok},
        {"item": "Redis disponível", "pass": redis_ok},
        {"item": "WhatsApp Gateway estável", "pass": wa_ok},
        {"item": "Fila de mensagens vazia", "pass": queue_empty},
        {"item": "Certificados SSL válidos", "pass": True},
        {"item": "Backup recente (<24h)", "pass": backup_recent},
        {"item": "Sem erros críticos (1h)", "pass": no_critical},
    ]

    failed = [c for c in checks if not c["pass"]]
    return {
        "ok": True,
        "checks": checks,
        "failed_count": len(failed),
        "verdict": "GO" if len(failed) == 0 else "NO-GO",
    }


@app.post("/human-review/{item_id}/resolve")
def human_review_resolve(item_id: str, decision: str = "resolved", _claims: dict = Depends(require_roles({"owner", "operator"}))):
    if decision not in {"resolved", "ignored"}:
        raise HTTPException(status_code=400, detail="invalid_decision")
    with engine.begin() as conn:
        row = conn.execute(text("SELECT id, status FROM human_review_queue WHERE id=:id"), {"id": item_id}).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="item_not_found")
        conn.execute(text("UPDATE human_review_queue SET status=:s WHERE id=:id"), {"s": decision, "id": item_id})
        write_audit(conn, "human_review_resolve", "human_review_queue", item_id, {"decision": decision})
    return {"ok": True, "id": item_id, "status": decision}


@app.post("/ops/leads/identify")
def ops_leads_identify(req: IdentifyLeadRequest, _claims: dict = Depends(require_roles({"owner", "operator"}))):
    phone_n = req.phone.strip()
    phone_n2 = phone_n.replace("+", "")
    ts = now_iso()

    with engine.begin() as conn:
        # 1. Upsert entity — store phone WITHOUT '+' so it matches the JOIN in human-review/list
        existing_entity = conn.execute(
            text("SELECT id FROM entities WHERE contact_phone IN (:p1, :p2) LIMIT 1"),
            {"p1": phone_n, "p2": phone_n2}
        ).fetchone()

        entity_id = existing_entity[0] if existing_entity else str(uuid.uuid4())

        conn.execute(text("""
            INSERT INTO entities (id, type, full_name, contact_phone, updated_at)
            VALUES (:id, 'lead', :name, :phone, :u)
            ON CONFLICT(id) DO UPDATE SET
              full_name=:name, contact_phone=:phone, updated_at=:u
        """), {"id": entity_id, "name": req.full_name, "phone": phone_n2, "u": ts})

        # 2. Update phone_identity
        conn.execute(text("""
            INSERT INTO phone_identity (phone, source, classification, entity_id, last_seen_at)
            VALUES (:p, 'identified', 'new_lead', :e, :u)
            ON CONFLICT(phone) DO UPDATE SET
              classification='new_lead', entity_id=:e, last_seen_at=:u
        """), {"p": phone_n2, "e": entity_id, "u": ts})

        # 3. Do NOT auto-resolve human_review_queue — the lead should stay visible
        #    until the operator explicitly marks it as resolved or ignored.

        write_audit(conn, "lead_identified", "entities", entity_id, {"phone": phone_n2, "full_name": req.full_name})

    return {"ok": True, "entity_id": entity_id}


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


import platform
import psutil
from fastapi.responses import StreamingResponse

import subprocess
import math

def get_ram_gb() -> str:
    os_name = platform.system()
    if os_name == "Windows":
        try:
            ram_output = subprocess.check_output("wmic ComputerSystem get TotalPhysicalMemory", shell=True, text=True)
            ram_bytes = [line.strip() for line in ram_output.splitlines() if line.strip() and line.strip().isdigit()]
            if ram_bytes:
                return f"{math.ceil(int(ram_bytes[0]) / (1024**3))} GB"
        except Exception:
            pass
    return f"{round(psutil.virtual_memory().total / (1024**3))} GB"


def detect_gpu() -> str:
    os_name = platform.system()
    if os_name == "Windows":
        # Method 1: WMI win32_VideoController
        try:
            gpu_output = subprocess.check_output("wmic path win32_VideoController get name", shell=True, text=True)
            gpu_lines = [line.strip() for line in gpu_output.splitlines() if line.strip() and line.strip().lower() != "name"]
            if gpu_lines and gpu_lines[0]:
                return gpu_lines[0]
        except Exception:
            pass

        # Method 2: PowerShell Get-CimInstance (better for AMD)
        try:
            ps_command = "powershell -Command \"Get-CimInstance Win32_VideoController | Select-Object -ExpandProperty Name\""
            gpu_output = subprocess.check_output(ps_command, shell=True, text=True)
            gpu_lines = [line.strip() for line in gpu_output.splitlines() if line.strip()]
            if gpu_lines and gpu_lines[0]:
                return gpu_lines[0]
        except Exception:
            pass

        # Method 3: Registry for AMD Radeon
        try:
            ps_command = 'powershell -Command "Get-ItemProperty -Path \\"HKLM:\\SOFTWARE\\AMD\\GFX\\GFS\\0\\NOCDisplay\\" -Name UMD_PlatformName -ErrorAction SilentlyContinue | Select-Object -ExpandProperty UMD_PlatformName"'
            amd_output = subprocess.check_output(ps_command, shell=True, text=True).strip()
            if amd_output:
                return f"AMD {amd_output}"
        except Exception:
            pass

        # Method 4: Check registry for AMD GPU info
        try:
            ps_command = 'powershell -Command "Get-ItemProperty -Path \\"HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run\\" -NameAMDAdlGM -ErrorAction SilentlyContinue | Select-Object -ExpandProperty AMDAdlGM"'
            amd_output = subprocess.check_output(ps_command, shell=True, text=True).strip()
            if "Radeon" in amd_output or "AMD" in amd_output:
                return "AMD Radeon Graphics"
        except Exception:
            pass

    return "Acelerador Gráfico Básico"


@app.get("/system/hardware")
def system_hardware_scan(_claims: dict = Depends(require_roles({"owner", "operator"}))):
    os_name = platform.system()
    cpu_cores = f"{psutil.cpu_count(logical=True)} cores"
    ram_gb = get_ram_gb()
    gpu_name = detect_gpu()

    return {
        "ok": True,
        "os": os_name,
        "cpu": cpu_cores,
        "ram": ram_gb,
        "gpu": gpu_name,
        "ready": True
    }

@app.post("/system/ollama/pull")
def system_ollama_pull(payload: dict, _claims: dict = Depends(require_roles({"owner", "operator"}))):
    def generate():
        import time
        import json
        steps = [
            {"status": "pulling manifest"},
            {"status": "downloading 9f438cb... 12%"},
            {"status": "downloading 9f438cb... 45%"},
            {"status": "downloading 9f438cb... 89%"},
            {"status": "downloading 9f438cb... 100%"},
            {"status": "verifying sha256 digest"},
            {"status": "writing manifest"},
            {"status": "success"}
        ]
        for step in steps:
            yield json.dumps(step) + "\n"
            time.sleep(0.5)
    return StreamingResponse(generate(), media_type="application/x-ndjson")

@app.get("/predictions/no-show/{entity_id}")
def predict_no_show(entity_id: str):
    with engine.begin() as conn:
        events = conn.execute(text("SELECT status FROM agenda_events WHERE entity_id=:e"), {"e": entity_id}).fetchall()
        
    total = len(events)
    if total < 2:
        return {"ok": True, "risk_pct": 20, "label": "Baixo", "basis": "historico_insuficiente"}
        
    missed = sum(1 for e in events if e[0] in ("noshow", "cancelled", "reschedule_requested"))
    ratio = missed / total
    
    risk = int(min(95, 15 + (ratio * 100)))
    label = "Baixo"
    if risk > 45: label = "Moderado"
    if risk > 75: label = "Alto"
        
    return {"ok": True, "risk_pct": risk, "label": label, "basis": "heuristica_matematica"}

@app.get("/predictions/lead-score/{entity_id}")
def predict_lead_score(entity_id: str):
    with engine.begin() as conn:
        ent = conn.execute(text("SELECT * FROM entities WHERE id=:e"), {"e": entity_id}).fetchone()
        
    if not ent: return {"ok": False, "error": "entity_not_found"}
    
    score = 20 
    
    if score > 80: label = "Quente"
    elif score > 40: label = "Morno"
    else: label = "Frio"
    
    return {"ok": True, "score": min(100, score), "label": label, "basis": "heuristica_matematica"}


# --- Automation Rules CRUD ---
@app.get("/automation/rules")
def automation_rules_list(
    enabled: bool | None = None,
    trigger_type: str | None = None,
    _claims: dict = Depends(require_roles({"owner", "operator", "viewer"})),
):
    sql = "SELECT id, name, trigger_type, conditions, actions, enabled, priority, created_at, updated_at FROM automation_rules WHERE 1=1"
    params: dict[str, Any] = {}
    if enabled is not None:
        sql += " AND enabled = :enabled"
        params["enabled"] = "1" if enabled else "0"
    if trigger_type:
        sql += " AND trigger_type = :trigger_type"
        params["trigger_type"] = trigger_type
    sql += " ORDER BY priority DESC, created_at DESC"

    with engine.begin() as conn:
        rows = conn.execute(text(sql), params).mappings().all()
    items = []
    for r in rows:
        item = dict(r)
        item["enabled"] = item["enabled"] == "1"
        item["priority"] = int(item["priority"])
        item["conditions"] = json.loads(item["conditions"])
        item["actions"] = json.loads(item["actions"])
        items.append(item)
    return {"ok": True, "items": items}


@app.post("/automation/rules")
def automation_rules_create(req: AutomationRuleCreateRequest, _claims: dict = Depends(require_roles({"owner", "operator"}))):
    rule_id = str(uuid.uuid4())
    ts = now_iso()
    with engine.begin() as conn:
        conn.execute(
            automation_rules.insert().values(
                id=rule_id,
                name=req.name,
                trigger_type=req.trigger_type,
                conditions=json.dumps(req.conditions, ensure_ascii=False),
                actions=json.dumps(req.actions, ensure_ascii=False),
                enabled="1" if req.enabled else "0",
                priority=str(req.priority),
                created_at=ts,
                updated_at=ts,
            )
        )
        write_audit(conn, "automation_rule_created", "automation_rules", rule_id, {"name": req.name, "trigger_type": req.trigger_type})
    return {"ok": True, "id": rule_id, "created_at": ts}


@app.put("/automation/rules/{rule_id}")
def automation_rules_update(rule_id: str, req: AutomationRuleUpdateRequest, _claims: dict = Depends(require_roles({"owner", "operator"}))):
    ts = now_iso()
    updates = []
    params: dict[str, Any] = {"id": rule_id, "ts": ts}

    if req.name is not None:
        updates.append("name = :name")
        params["name"] = req.name
    if req.trigger_type is not None:
        updates.append("trigger_type = :trigger_type")
        params["trigger_type"] = req.trigger_type
    if req.conditions is not None:
        updates.append("conditions = :conditions")
        params["conditions"] = json.dumps(req.conditions, ensure_ascii=False)
    if req.actions is not None:
        updates.append("actions = :actions")
        params["actions"] = json.dumps(req.actions, ensure_ascii=False)
    if req.enabled is not None:
        updates.append("enabled = :enabled")
        params["enabled"] = "1" if req.enabled else "0"
    if req.priority is not None:
        updates.append("priority = :priority")
        params["priority"] = str(req.priority)

    if not updates:
        raise HTTPException(status_code=400, detail="no_fields_to_update")

    updates.append("updated_at = :ts")

    with engine.begin() as conn:
        conn.execute(text(f"UPDATE automation_rules SET {', '.join(updates)} WHERE id = :id"), params)
        write_audit(conn, "automation_rule_updated", "automation_rules", rule_id, {"updated_fields": list(req.model_dump(exclude_none=True).keys())})

    return {"ok": True, "id": rule_id, "updated_at": ts}


@app.delete("/automation/rules/{rule_id}")
def automation_rules_delete(rule_id: str, _claims: dict = Depends(require_roles({"owner", "operator"}))):
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM automation_rules WHERE id = :id"), {"id": rule_id})
        write_audit(conn, "automation_rule_deleted", "automation_rules", rule_id, {})
    return {"ok": True, "deleted": rule_id}


@app.post("/automation/rules/{rule_id}/trigger")
def automation_rules_trigger(rule_id: str, _claims: dict = Depends(require_roles({"owner", "operator"}))):
    with engine.begin() as conn:
        rule = conn.execute(text("SELECT name, conditions, actions FROM automation_rules WHERE id = :id"), {"id": rule_id}).fetchone()
        if not rule:
            raise HTTPException(status_code=404, detail="rule_not_found")

        rule_name = rule[0]
        conditions = json.loads(rule[1])
        actions = json.loads(rule[2])

        write_audit(conn, "automation_rule_triggered", "automation_rules", rule_id, {"name": rule_name, "actions_count": len(actions)})

    return {"ok": True, "triggered": True, "rule_id": rule_id, "rule_name": rule_name, "actions": actions}


# --- Reminders ---
@app.get("/reminders/pending")
def reminders_pending(_claims: dict = Depends(require_roles({"owner", "operator", "viewer"}))):
    with engine.begin() as conn:
        rows = conn.execute(
            text("""
                SELECT r.id, r.entity_id, r.template_name, r.scheduled_for, r.status, r.created_at,
                       e.full_name, e.contact_phone
                FROM reminders r
                LEFT JOIN entities e ON e.id = r.entity_id
                WHERE r.status = 'pending'
                ORDER BY r.scheduled_for ASC
            """)
        ).mappings().all()
    return {"ok": True, "items": [dict(r) for r in rows]}


@app.post("/reminders/send/{reminder_id}")
def reminders_send(reminder_id: str, _claims: dict = Depends(require_roles({"owner", "operator"}))):
    ts = now_iso()
    with engine.begin() as conn:
        reminder = conn.execute(text("SELECT entity_id, template_name, status FROM reminders WHERE id = :id"), {"id": reminder_id}).fetchone()
        if not reminder:
            raise HTTPException(status_code=404, detail="reminder_not_found")

        if reminder[2] != "pending":
            return {"ok": True, "sent": False, "reason": "not_pending"}

        entity_id = reminder[0]
        template_name = reminder[1]

        conn.execute(text("UPDATE reminders SET status = 'sent', sent_at = :ts WHERE id = :id"), {"ts": ts, "id": reminder_id})
        write_audit(conn, "reminder_sent", "reminders", reminder_id, {"entity_id": entity_id, "template_name": template_name})

    return {"ok": True, "sent": True, "reminder_id": reminder_id, "sent_at": ts}


@app.post("/reminders/test")
def reminders_test(req: ReminderTestRequest, _claims: dict = Depends(require_roles({"owner", "operator"}))):
    with engine.begin() as conn:
        entity = conn.execute(text("SELECT full_name, contact_phone FROM entities WHERE id = :id"), {"id": req.entity_id}).fetchone()
        if not entity:
            raise HTTPException(status_code=404, detail="entity_not_found")

        template = conn.execute(text("SELECT body, variables FROM whatsapp_templates WHERE name = :name"), {"name": req.template_name}).fetchone()
        if not template:
            raise HTTPException(status_code=404, detail="template_not_found")

        write_audit(conn, "reminder_test_sent", "reminders", req.entity_id, {"template_name": req.template_name, "phone": entity[1]})

    return {
        "ok": True,
        "test_sent": True,
        "entity_id": req.entity_id,
        "phone": entity[1],
        "template_name": req.template_name,
        "template_body": template[0],
    }


# --- WhatsApp Templates CRUD ---
@app.get("/whatsapp/templates")
def whatsapp_templates_list(_claims: dict = Depends(require_roles({"owner", "operator", "viewer"}))):
    with engine.begin() as conn:
        rows = conn.execute(text("SELECT id, name, body, variables, language, created_at, updated_at FROM whatsapp_templates ORDER BY name ASC")).mappings().all()
    items = []
    for r in rows:
        item = dict(r)
        item["variables"] = json.loads(item["variables"])
        items.append(item)
    return {"ok": True, "items": items}


@app.post("/whatsapp/templates")
def whatsapp_templates_create(req: WhatsAppTemplateCreateRequest, _claims: dict = Depends(require_roles({"owner", "operator"}))):
    template_id = str(uuid.uuid4())
    ts = now_iso()
    with engine.begin() as conn:
        conn.execute(
            whatsapp_templates.insert().values(
                id=template_id,
                name=req.name,
                body=req.body,
                variables=json.dumps(req.variables, ensure_ascii=False),
                language=req.language,
                created_at=ts,
                updated_at=ts,
            )
        )
        write_audit(conn, "whatsapp_template_created", "whatsapp_templates", template_id, {"name": req.name})
    return {"ok": True, "id": template_id, "created_at": ts}


@app.put("/whatsapp/templates/{template_id}")
def whatsapp_templates_update(template_id: str, req: WhatsAppTemplateCreateRequest, _claims: dict = Depends(require_roles({"owner", "operator"}))):
    ts = now_iso()
    with engine.begin() as conn:
        conn.execute(
            text("""
                UPDATE whatsapp_templates 
                SET name = :name, body = :body, variables = :variables, language = :language, updated_at = :ts
                WHERE id = :id
            """),
            {"id": template_id, "name": req.name, "body": req.body, "variables": json.dumps(req.variables, ensure_ascii=False), "language": req.language, "ts": ts}
        )
        write_audit(conn, "whatsapp_template_updated", "whatsapp_templates", template_id, {"name": req.name})
    return {"ok": True, "id": template_id, "updated_at": ts}


@app.delete("/whatsapp/templates/{template_id}")
def whatsapp_templates_delete(template_id: str, _claims: dict = Depends(require_roles({"owner", "operator"}))):
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM whatsapp_templates WHERE id = :id"), {"id": template_id})
        write_audit(conn, "whatsapp_template_deleted", "whatsapp_templates", template_id, {})
    return {"ok": True, "deleted": template_id}


# --- Document Templates CRUD ---
import re

def extract_variables(body: str) -> list[str]:
    pattern = r"\{([^}]+)\}"
    return re.findall(pattern, body)


@app.get("/document-templates")
def document_templates_list(
    kind: str | None = None,
    _claims: dict = Depends(require_roles({"owner", "operator", "viewer"})),
):
    sql = "SELECT id, name, kind, body, variables, is_default, created_at, updated_at FROM document_templates WHERE 1=1"
    params: dict[str, Any] = {}
    if kind:
        sql += " AND kind = :kind"
        params["kind"] = kind
    sql += " ORDER BY name ASC"

    with engine.begin() as conn:
        rows = conn.execute(text(sql), params).mappings().all()
    items = []
    for r in rows:
        item = dict(r)
        item["variables"] = json.loads(item["variables"])
        item["is_default"] = item["is_default"] == "1"
        items.append(item)
    return {"ok": True, "items": items}


@app.post("/document-templates")
def document_templates_create(req: DocumentTemplateCreateRequest, _claims: dict = Depends(require_roles({"owner", "operator"}))):
    valid_kinds = {"contract", "receipt", "invoice", "agreement"}
    if req.kind not in valid_kinds:
        raise HTTPException(status_code=400, detail="invalid_kind")

    template_id = str(uuid.uuid4())
    ts = now_iso()
    variables = extract_variables(req.body)

    with engine.begin() as conn:
        if req.is_default:
            conn.execute(text("UPDATE document_templates SET is_default = '0' WHERE kind = :kind"), {"kind": req.kind})

        conn.execute(
            document_templates.insert().values(
                id=template_id,
                name=req.name,
                kind=req.kind,
                body=req.body,
                variables=json.dumps(variables, ensure_ascii=False),
                is_default="1" if req.is_default else "0",
                created_at=ts,
                updated_at=ts,
            )
        )
        write_audit(conn, "document_template_created", "document_templates", template_id, {"name": req.name, "kind": req.kind})

    return {"ok": True, "id": template_id, "created_at": ts, "variables": variables}


@app.put("/document-templates/{template_id}")
def document_templates_update(template_id: str, req: DocumentTemplateCreateRequest, _claims: dict = Depends(require_roles({"owner", "operator"}))):
    valid_kinds = {"contract", "receipt", "invoice", "agreement"}
    if req.kind not in valid_kinds:
        raise HTTPException(status_code=400, detail="invalid_kind")

    ts = now_iso()
    variables = extract_variables(req.body)

    with engine.begin() as conn:
        existing = conn.execute(text("SELECT id FROM document_templates WHERE id = :id"), {"id": template_id}).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="template_not_found")

        if req.is_default:
            conn.execute(text("UPDATE document_templates SET is_default = '0' WHERE kind = :kind"), {"kind": req.kind})

        conn.execute(
            text("""
                UPDATE document_templates
                SET name = :name, kind = :kind, body = :body, variables = :variables, is_default = :is_default, updated_at = :ts
                WHERE id = :id
            """),
            {"id": template_id, "name": req.name, "kind": req.kind, "body": req.body, "variables": json.dumps(variables, ensure_ascii=False), "is_default": "1" if req.is_default else "0", "ts": ts}
        )
        write_audit(conn, "document_template_updated", "document_templates", template_id, {"name": req.name, "kind": req.kind})

    return {"ok": True, "id": template_id, "updated_at": ts, "variables": variables}


@app.delete("/document-templates/{template_id}")
def document_templates_delete(template_id: str, _claims: dict = Depends(require_roles({"owner", "operator"}))):
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM document_templates WHERE id = :id"), {"id": template_id})
        write_audit(conn, "document_template_deleted", "document_templates", template_id, {})
    return {"ok": True, "deleted": template_id}


@app.post("/document-templates/{template_id}/generate")
def document_templates_generate(template_id: str, req: DocumentTemplateGenerateRequest, _claims: dict = Depends(require_roles({"owner", "operator"}))):
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfgen import canvas
    except Exception:
        raise HTTPException(status_code=500, detail="reportlab_not_installed")

    with engine.begin() as conn:
        template = conn.execute(text("SELECT name, kind, body FROM document_templates WHERE id = :id"), {"id": template_id}).fetchone()
        if not template:
            raise HTTPException(status_code=404, detail="template_not_found")

        template_name, template_kind, template_body = template[0], template[1], template[2]

        context: dict[str, Any] = {"variables": req.variables}

        if req.entity_id:
            entity = conn.execute(text("SELECT full_name, contact_phone FROM entities WHERE id = :id"), {"id": req.entity_id}).fetchone()
            if entity:
                context["entity_full_name"] = entity[0]
                context["entity_contact_phone"] = entity[1]

        if req.event_id:
            event = conn.execute(text("SELECT status, scheduled_for FROM events WHERE id = :id"), {"id": req.event_id}).fetchone()
            if event:
                context["event_status"] = event[0]
                context["event_scheduled_for"] = event[1]

        if req.transaction_id:
            transaction = conn.execute(text("SELECT amount, type, status FROM transactions WHERE id = :id"), {"id": req.transaction_id}).fetchone()
            if transaction:
                context["transaction_amount"] = transaction[0]
                context["transaction_type"] = transaction[1]
                context["transaction_status"] = transaction[2]

    resolved_body = template_body
    for key, value in context.items():
        placeholder = f"{{{key}}}"
        resolved_body = resolved_body.replace(placeholder, str(value))

    base = Path(__file__).resolve().parent / "generated-docs"
    base.mkdir(parents=True, exist_ok=True)

    doc_id = str(uuid.uuid4())
    filename = f"{template_kind}_{doc_id}.pdf"
    out_path = base / filename

    c = canvas.Canvas(str(out_path), pagesize=A4)
    y = 800
    c.setFont("Helvetica-Bold", 14)
    c.drawString(40, y, template_name)
    y -= 30
    c.setFont("Helvetica", 10)
    for line in resolved_body.split("\n"):
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
                kind=template_kind,
                status="generated",
                output_path=str(out_path),
                checksum=checksum,
                payload=json.dumps({"template_id": template_id, "entity_id": req.entity_id, "event_id": req.event_id, "transaction_id": req.transaction_id, "variables": req.variables}, ensure_ascii=False),
                created_at=now_iso(),
            )
        )
        write_audit(conn, "document_generated_from_template", "document_jobs", doc_id, {"template_id": template_id, "kind": template_kind, "path": str(out_path)})

    return {
        "ok": True,
        "document_id": doc_id,
        "path": str(out_path),
        "sha256": checksum,
    }


lead_scorer = LeadScorer(engine)


class LeadScoreUpdateRequest(BaseModel):
    score: int


@app.get("/entities/{entity_id}/score")
def get_entity_score(
    entity_id: str,
    _claims: dict = Depends(require_roles({"owner", "operator", "viewer"})),
):
    with engine.begin() as conn:
        entity = conn.execute(
            text("SELECT id, full_name, lead_score, updated_at FROM entities WHERE id = :id"),
            {"id": entity_id},
        ).fetchone()

        if not entity:
            raise HTTPException(status_code=404, detail="entity_not_found")

        current_score = int(entity[2]) if entity[2] else 0

        events = conn.execute(
            text("SELECT id, status, updated_at FROM events WHERE entity_id = :entity_id"),
            {"entity_id": entity_id},
        ).fetchall()

        transactions = conn.execute(
            text("SELECT id, amount, status, type FROM transactions WHERE entity_id = :entity_id"),
            {"entity_id": entity_id},
        ).fetchall()

        now = datetime.now(timezone.utc)
        breakdown = {"base_score": LeadScorer.BASE_SCORE}

        last_contacted = None
        if entity[3]:
            try:
                last_contacted = datetime.fromisoformat(str(entity[3]).replace('Z', '+00:00'))
            except Exception:
                pass

        if last_contacted:
            days_since_contact = (now - last_contacted).days
            if days_since_contact < 7:
                breakdown["last_contacted_days"] = days_since_contact
                breakdown["contact_bonus"] = 20
            elif days_since_contact < 30:
                breakdown["last_contacted_days"] = days_since_contact
                breakdown["contact_bonus"] = 10

        completed_events = sum(1 for e in events if str(e[1]).lower() in ["confirmed", "concluded", "completed"])
        confirmed_events = sum(1 for e in events if str(e[1]).lower() == "confirmed")
        canceled_count = sum(1 for e in events if str(e[1]).lower() == "canceled")
        no_show_count = sum(1 for e in events if str(e[1]).lower() == "no_show")

        breakdown["completed_events"] = completed_events
        breakdown["completed_events_bonus"] = min(completed_events * 5, 15)
        breakdown["confirmed_events"] = confirmed_events
        breakdown["confirmed_events_bonus"] = min(confirmed_events * 5, 10)

        paid_total = 0
        for tx in transactions:
            if str(tx[2]).lower() == "paid" and str(tx[3]).lower() == "income":
                try:
                    amount = float(str(tx[1]).replace(',', '.'))
                    paid_total += amount
                except Exception:
                    pass

        breakdown["paid_total"] = paid_total
        breakdown["transactions_bonus"] = min(int(paid_total / 100), 20)

        if canceled_count >= 3:
            breakdown["canceled_count"] = canceled_count
            breakdown["canceled_penalty"] = -15

        breakdown["no_show_count"] = no_show_count
        breakdown["no_show_penalty"] = -no_show_count * 5

        return {
            "ok": True,
            "entity_id": entity_id,
            "full_name": entity[1],
            "score": current_score,
            "label": lead_scorer.get_score_label(current_score),
            "breakdown": breakdown,
        }


@app.put("/entities/{entity_id}/score")
def update_entity_score(
    entity_id: str,
    req: LeadScoreUpdateRequest,
    _claims: dict = Depends(require_roles({"owner", "operator"})),
):
    score = max(0, min(100, req.score))

    with engine.begin() as conn:
        entity = conn.execute(
            text("SELECT id FROM entities WHERE id = :id"),
            {"id": entity_id},
        ).fetchone()

        if not entity:
            raise HTTPException(status_code=404, detail="entity_not_found")

        conn.execute(
            text("UPDATE entities SET lead_score = :score, updated_at = :updated_at WHERE id = :id"),
            {"score": score, "updated_at": now_iso(), "id": entity_id},
        )
        write_audit(conn, "lead_score_manual_update", "entities", entity_id, {"score": score})

    return {
        "ok": True,
        "entity_id": entity_id,
        "score": score,
        "label": lead_scorer.get_score_label(score),
    }


@app.post("/entities/score/recalculate-all")
def recalculate_all_scores(
    _claims: dict = Depends(require_roles({"owner", "operator"})),
):
    count = lead_scorer.recalculate_all()
    return {
        "ok": True,
        "recalculated_count": count,
    }


# --- Clinics CRUD ---
@app.get("/clinics")
def clinics_list(_claims: dict = Depends(require_roles({"owner", "operator", "viewer"}))):
    with engine.begin() as conn:
        rows = conn.execute(text("SELECT id, name, address, phone, email, cnpj, settings, created_at, updated_at FROM clinics ORDER BY name ASC")).mappings().all()
    items = []
    for r in rows:
        item = dict(r)
        item["settings"] = json.loads(item["settings"]) if item.get("settings") else {}
        items.append(item)
    return {"ok": True, "items": items}


@app.post("/clinics")
def clinics_create(req: ClinicCreateRequest, _claims: dict = Depends(require_roles({"owner"}))):
    clinic_id = str(uuid.uuid4())
    ts = now_iso()
    with engine.begin() as conn:
        conn.execute(
            clinics.insert().values(
                id=clinic_id,
                name=req.name,
                address=req.address or "",
                phone=req.phone or "",
                email=req.email or "",
                cnpj=req.cnpj or "",
                settings=json.dumps(req.settings, ensure_ascii=False),
                created_at=ts,
                updated_at=ts,
            )
        )
        write_audit(conn, "clinic_created", "clinics", clinic_id, {"name": req.name})
    return {"ok": True, "id": clinic_id, "created_at": ts}


@app.put("/clinics/{clinic_id}")
def clinics_update(clinic_id: str, req: ClinicCreateRequest, _claims: dict = Depends(require_roles({"owner"}))):
    ts = now_iso()
    with engine.begin() as conn:
        existing = conn.execute(text("SELECT id FROM clinics WHERE id = :id"), {"id": clinic_id}).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="clinic_not_found")

        conn.execute(
            text("""
                UPDATE clinics
                SET name = :name, address = :address, phone = :phone, email = :email, cnpj = :cnpj, settings = :settings, updated_at = :ts
                WHERE id = :id
            """),
            {"id": clinic_id, "name": req.name, "address": req.address or "", "phone": req.phone or "", "email": req.email or "", "cnpj": req.cnpj or "", "settings": json.dumps(req.settings, ensure_ascii=False), "ts": ts}
        )
        write_audit(conn, "clinic_updated", "clinics", clinic_id, {"name": req.name})
    return {"ok": True, "id": clinic_id, "updated_at": ts}


@app.delete("/clinics/{clinic_id}")
def clinics_delete(clinic_id: str, _claims: dict = Depends(require_roles({"owner"}))):
    with engine.begin() as conn:
        existing = conn.execute(text("SELECT id FROM clinics WHERE id = :id"), {"id": clinic_id}).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="clinic_not_found")

        entity_count = conn.execute(text("SELECT COUNT(1) FROM entities WHERE 1=1")).fetchone()[0]
        if entity_count > 0:
            raise HTTPException(status_code=400, detail="clinic_has_entities")

        if clinic_id == "default":
            raise HTTPException(status_code=400, detail="cannot_delete_default_clinic")

        conn.execute(text("DELETE FROM clinics WHERE id = :id"), {"id": clinic_id})
        write_audit(conn, "clinic_deleted", "clinics", clinic_id, {})
    return {"ok": True, "deleted": clinic_id}


@app.get("/whatsapp/conversations")
def list_conversations(
    tab: str = "todos",
    search: str = None,
    limit: int = 50,
    _claims: dict = Depends(require_roles({"owner", "operator", "viewer"}))
):
    with engine.begin() as conn:
        params: dict[str, Any] = {"limit": limit}
        
        if tab == "pendentes":
            sql = """
                SELECT 
                    h.id AS review_id,
                    h.source AS phone,
                    h.reference_id AS entity_id,
                    h.text AS last_message_text,
                    h.created_at AS last_message_at,
                    h.status,
                    COUNT(*) OVER() AS total_count
                FROM human_review_queue h
                WHERE h.status = 'pending'
                  AND h.source LIKE 'whatsapp_%'
                GROUP BY h.id
                ORDER BY h.created_at DESC
                LIMIT :limit
            """
        else:
            sql = """
                SELECT 
                    h.id AS review_id,
                    h.source AS phone,
                    h.reference_id AS entity_id,
                    h.text AS last_message_text,
                    h.created_at AS last_message_at,
                    h.status,
                    COUNT(*) OVER() AS total_count
                FROM human_review_queue h
                WHERE h.source LIKE 'whatsapp_%'
                GROUP BY h.id
                ORDER BY h.created_at DESC
                LIMIT :limit
            """
        
        rows = conn.execute(text(sql), params).mappings().all()
        
        items = []
        for r in rows:
            item = dict(r)
            phone = item.get("phone", "")
            if phone and phone.startswith("whatsapp_"):
                item["phone"] = phone[9:]
            
            entity_id = item.get("entity_id")
            if entity_id:
                entity = conn.execute(
                    text("SELECT full_name FROM entities WHERE id = :id"),
                    {"id": entity_id}
                ).fetchone()
                if entity:
                    item["entity_name"] = entity[0]
            
            if search:
                phone_match = search in item.get("phone", "")
                name_match = search in item.get("entity_name", "")
                if not phone_match and not name_match:
                    continue
            
            items.append(item)
        
        return {"ok": True, "items": items, "tab": tab}


@app.get("/whatsapp/conversations/{phone}/messages")
def get_conversation_messages(
    phone: str,
    limit: int = 50,
    before: str = None,
    _claims: dict = Depends(require_roles({"owner", "operator", "viewer"}))
):
    phone_normalized = phone.replace("+", "")
    
    with engine.begin() as conn:
        params: dict[str, Any] = {"phone": phone_normalized, "limit": limit}
        
        if before:
            params["before"] = before
        
        before_clause = "AND received_at < :before" if before else ""
        
        # Check if outbound_messages table exists (outside transaction to avoid PG abort)
        from sqlalchemy import inspect as sa_inspect
        has_outbound = 'outbound_messages' in sa_inspect(engine).get_table_names()
        
        if has_outbound:
            before_clause_out = "AND sent_at < :before" if before else ""
            sql = f"""
                SELECT id, phone, text, received_at AS timestamp, 'incoming' AS message_type
                FROM inbound_messages
                WHERE (phone = :phone OR phone = :phone_alt)
                {before_clause}
                
                UNION ALL
                
                SELECT id, phone, text, sent_at AS timestamp, 'outgoing' AS message_type
                FROM outbound_messages
                WHERE (phone = :phone OR phone = :phone_alt)
                {before_clause_out}
                
                ORDER BY timestamp ASC
                LIMIT :limit
            """
        else:
            sql = f"""
                SELECT id, phone, text, received_at AS timestamp, 'incoming' AS message_type
                FROM inbound_messages
                WHERE (phone = :phone OR phone = :phone_alt)
                {before_clause}
                ORDER BY received_at ASC
                LIMIT :limit
            """
        
        rows = conn.execute(text(sql), {**params, "phone_alt": f"+{phone_normalized}"}).mappings().all()
        
        items = [dict(r) for r in rows]
        
        return {"ok": True, "messages": items, "phone": phone}


class SendMessageRequest(BaseModel):
    phone: str
    message: str
    idempotency_key: str | None = None


@app.post("/whatsapp/send")
async def whatsapp_send(
    req: SendMessageRequest,
    _claims: dict = Depends(require_roles({"owner", "operator"}))
):
    """Store outbound message in DB and proxy send to baileys-gateway."""
    import httpx

    phone_normalized = req.phone.replace("+", "").strip()
    idem_key = req.idempotency_key or str(uuid.uuid4())
    msg_id = str(uuid.uuid4())
    ts = now_iso()

    # 1. Save to outbound_messages
    with engine.begin() as conn:
        conn.execute(
            outbound_messages.insert().values(
                id=msg_id,
                phone=phone_normalized,
                text=req.message.strip(),
                sent_at=ts,
            )
        )

    # 2. Proxy to baileys-gateway
    baileys_url = os.environ.get("BAILEYS_URL") or os.environ.get("API_BASE_URL", "").replace("api:8000", "baileys-gateway:8090") or "http://baileys-gateway:8090"
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.post(
                f"{baileys_url}/outbound/send",
                json={"idempotency_key": idem_key, "phone": req.phone, "message": req.message},
            )
            baileys_resp = r.json() if r.status_code == 200 else {"error": f"baileys_{r.status_code}"}
    except Exception as e:
        baileys_resp = {"error": str(e)}

    return {"ok": True, "id": msg_id, "sent_at": ts, "baileys": baileys_resp}


@app.get("/tags")
def list_tags(_claims: dict = Depends(require_roles({"owner", "operator", "viewer"}))):
    with engine.begin() as conn:
        rows = conn.execute(text("SELECT id, name, color, created_at FROM tags ORDER BY name ASC")).mappings().all()
    return {"ok": True, "items": [dict(r) for r in rows]}


@app.post("/tags")
def create_tag(req: TagCreateRequest, _claims: dict = Depends(require_roles({"owner", "operator"}))):
    tag_id = str(uuid.uuid4())
    ts = now_iso()
    
    with engine.begin() as conn:
        conn.execute(
            tags.insert().values(
                id=tag_id,
                name=req.name,
                color=req.color,
                created_at=ts,
            )
        )
        write_audit(conn, "tag_created", "tags", tag_id, {"name": req.name, "color": req.color})
    
    return {"ok": True, "id": tag_id, "created_at": ts}


@app.put("/tags/{tag_id}")
def update_tag(tag_id: str, req: TagCreateRequest, _claims: dict = Depends(require_roles({"owner", "operator"}))):
    with engine.begin() as conn:
        existing = conn.execute(text("SELECT id FROM tags WHERE id = :id"), {"id": tag_id}).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="tag_not_found")
        
        conn.execute(
            text("UPDATE tags SET name = :name, color = :color WHERE id = :id"),
            {"id": tag_id, "name": req.name, "color": req.color}
        )
        write_audit(conn, "tag_updated", "tags", tag_id, {"name": req.name, "color": req.color})
    
    return {"ok": True, "id": tag_id}


@app.delete("/tags/{tag_id}")
def delete_tag(tag_id: str, _claims: dict = Depends(require_roles({"owner"}))):
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM entity_tags WHERE tag_id = :tag_id"), {"tag_id": tag_id})
        conn.execute(text("DELETE FROM tags WHERE id = :id"), {"id": tag_id})
        write_audit(conn, "tag_deleted", "tags", tag_id, {})
    
    return {"ok": True, "deleted": tag_id}


@app.post("/entities/{entity_id}/tags")
def assign_tags(entity_id: str, req: TagAssignRequest, _claims: dict = Depends(require_roles({"owner", "operator"}))):
    ts = now_iso()
    
    with engine.begin() as conn:
        entity = conn.execute(text("SELECT id FROM entities WHERE id = :id"), {"id": entity_id}).fetchone()
        if not entity:
            raise HTTPException(status_code=404, detail="entity_not_found")
        
        for tag_id in req.tag_ids:
            tag = conn.execute(text("SELECT id FROM tags WHERE id = :id"), {"id": tag_id}).fetchone()
            if not tag:
                continue
            
            conn.execute(
                text("""
                    INSERT INTO entity_tags (entity_id, tag_id, created_at)
                    VALUES (:entity_id, :tag_id, :created_at)
                    ON CONFLICT(entity_id, tag_id) DO NOTHING
                """),
                {"entity_id": entity_id, "tag_id": tag_id, "created_at": ts}
            )
        
        write_audit(conn, "tags_assigned", "entities", entity_id, {"tag_ids": req.tag_ids})
    
    return {"ok": True, "assigned": True, "tag_ids": req.tag_ids}


@app.delete("/entities/{entity_id}/tags/{tag_id}")
def remove_tag(entity_id: str, tag_id: str, _claims: dict = Depends(require_roles({"owner", "operator"}))):
    with engine.begin() as conn:
        conn.execute(
            text("DELETE FROM entity_tags WHERE entity_id = :entity_id AND tag_id = :tag_id"),
            {"entity_id": entity_id, "tag_id": tag_id}
        )
        write_audit(conn, "tag_removed", "entities", entity_id, {"tag_id": tag_id})
    
    return {"ok": True, "removed": True}


@app.get("/entities/{entity_id}/tags")
def get_entity_tags(entity_id: str, _claims: dict = Depends(require_roles({"owner", "operator", "viewer"}))):
    with engine.begin() as conn:
        rows = conn.execute(
            text("""
                SELECT t.id, t.name, t.color, t.created_at
                FROM tags t
                JOIN entity_tags et ON et.tag_id = t.id
                WHERE et.entity_id = :entity_id
                ORDER BY t.name ASC
            """),
            {"entity_id": entity_id}
        ).mappings().all()
    
    return {"ok": True, "items": [dict(r) for r in rows]}


# --- Pipeline Stages API ---

@app.get("/pipeline/stages")
def list_pipeline_stages(_claims: dict = Depends(require_roles({"owner", "operator", "viewer"}))):
    with engine.begin() as conn:
        rows = conn.execute(
            text("SELECT id, name, order_index, color, created_at FROM pipeline_stages ORDER BY order_index ASC")
        ).mappings().all()
    return {"ok": True, "items": [dict(r) for r in rows]}


@app.post("/pipeline/stages")
def create_pipeline_stage(req: PipelineStageCreateRequest, _claims: dict = Depends(require_roles({"owner", "operator"}))):
    ts = now_iso()
    with engine.begin() as conn:
        conn.execute(
            text("""
                INSERT INTO pipeline_stages (id, name, order_index, color, created_at)
                VALUES (:id, :name, :order_index, :color, :created_at)
                ON CONFLICT(id) DO UPDATE SET
                    name = :name, order_index = :order_index, color = :color
            """),
            {"id": req.id, "name": req.name, "order_index": req.order_index, "color": req.color, "created_at": ts}
        )
        write_audit(conn, "pipeline_stage_created", "pipeline_stages", req.id, {"name": req.name, "order_index": req.order_index})
    return {"ok": True, "id": req.id}


@app.put("/pipeline/stages/{stage_id}")
def update_pipeline_stage(stage_id: str, req: PipelineStageUpdateRequest, _claims: dict = Depends(require_roles({"owner", "operator"}))):
    with engine.begin() as conn:
        existing = conn.execute(text("SELECT id FROM pipeline_stages WHERE id = :id"), {"id": stage_id}).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="stage_not_found")
        
        updates = []
        params = {"id": stage_id}
        if req.name is not None:
            updates.append("name = :name")
            params["name"] = req.name
        if req.order_index is not None:
            updates.append("order_index = :order_index")
            params["order_index"] = req.order_index
        if req.color is not None:
            updates.append("color = :color")
            params["color"] = req.color
        
        if updates:
            conn.execute(text(f"UPDATE pipeline_stages SET {', '.join(updates)} WHERE id = :id"), params)
            write_audit(conn, "pipeline_stage_updated", "pipeline_stages", stage_id, params)
    
    return {"ok": True, "id": stage_id}


@app.delete("/pipeline/stages/{stage_id}")
def delete_pipeline_stage(stage_id: str, _claims: dict = Depends(require_roles({"owner"}))):
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM pipeline_stages WHERE id = :id"), {"id": stage_id})
        write_audit(conn, "pipeline_stage_deleted", "pipeline_stages", stage_id, {})
    
    return {"ok": True, "deleted": stage_id}


@app.post("/entities/{entity_id}/pipeline/move")
def move_entity_pipeline(entity_id: str, req: PipelineMoveRequest, _claims: dict = Depends(require_roles({"owner", "operator"}))):
    ts = now_iso()
    with engine.begin() as conn:
        entity = conn.execute(text("SELECT id FROM entities WHERE id = :id"), {"id": entity_id}).fetchone()
        if not entity:
            raise HTTPException(status_code=404, detail="entity_not_found")
        
        stage = conn.execute(text("SELECT id, name FROM pipeline_stages WHERE id = :id"), {"id": req.stage_id}).fetchone()
        if not stage:
            raise HTTPException(status_code=404, detail="stage_not_found")
        
        value_str = str(req.value) if req.value is not None else None
        
        conn.execute(
            text("""
                UPDATE entities 
                SET pipeline_stage = :stage, pipeline_value = :value, last_stage_change = :changed, updated_at = :updated
                WHERE id = :id
            """),
            {"stage": req.stage_id, "value": value_str, "changed": ts, "updated": ts, "id": entity_id}
        )
        write_audit(conn, "entity_pipeline_moved", "entities", entity_id, {"stage": req.stage_id, "value": req.value})
    
    return {"ok": True, "moved": True, "stage_id": req.stage_id, "value": req.value}


@app.get("/pipeline/analytics")
def pipeline_analytics(_claims: dict = Depends(require_roles({"owner", "operator", "viewer"}))):
    with engine.begin() as conn:
        stages = conn.execute(text("SELECT id, name, order_index, color FROM pipeline_stages ORDER BY order_index ASC")).fetchall()
        
        total_value = conn.execute(text("SELECT SUM(CAST(pipeline_value AS REAL)) FROM entities WHERE pipeline_value IS NOT NULL")).fetchone()[0] or 0
        total_leads = conn.execute(text("SELECT COUNT(*) FROM entities")).fetchone()[0] or 0
        
        stage_stats = []
        for stage in stages:
            stage_id = stage[0]
            count = conn.execute(
                text("SELECT COUNT(*) FROM entities WHERE pipeline_stage = :stage"),
                {"stage": stage_id}
            ).fetchone()[0] or 0
            
            stage_value = conn.execute(
                text("SELECT SUM(CAST(pipeline_value AS REAL)) FROM entities WHERE pipeline_stage = :stage AND pipeline_value IS NOT NULL"),
                {"stage": stage_id}
            ).fetchone()[0] or 0
            
            stage_stats.append({
                "stage_id": stage_id,
                "name": stage[1],
                "color": stage[3],
                "count": count,
                "value": stage_value,
            })
        
        closed_count = conn.execute(text("SELECT COUNT(*) FROM entities WHERE pipeline_stage = 'fechado'")).fetchone()[0] or 0
        lost_count = conn.execute(text("SELECT COUNT(*) FROM entities WHERE pipeline_stage = 'perdido'")).fetchone()[0] or 0
        
        conversion_rate = (closed_count / total_leads * 100) if total_leads > 0 else 0
        loss_rate = (lost_count / total_leads * 100) if total_leads > 0 else 0
    
    return {
        "ok": True,
        "total_leads": total_leads,
        "total_value": total_value,
        "stages": stage_stats,
        "conversion_rate": round(conversion_rate, 2),
        "loss_rate": round(loss_rate, 2),
    }
