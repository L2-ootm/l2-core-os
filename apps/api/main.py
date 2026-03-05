from fastapi import FastAPI, Header, HTTPException, Request, Depends
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, MetaData, Table, Column, String, Text
from sqlalchemy.sql import text
from datetime import datetime, timezone, timedelta
from typing import Any
import json
import hmac
import hashlib
import time
import jwt
from core.config import settings

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
            "whatsapp": ["BAILEYS_SESSION_NAME", "BAILEYS_QR_AUTO", "BAILEYS_WEBHOOK_TARGET"],
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
def mobile_sync_pull(since: str | None = None, _claims: dict = Depends(require_roles({"owner", "operator", "viewer"}))):
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
def mobile_sync_push(req: MobilePushRequest, _claims: dict = Depends(require_roles({"owner", "operator"}))):
    row_id = f"{req.device_id}:{req.sync_batch_id}"
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
            }

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
        "accepted_changes": len(req.changes),
    }
