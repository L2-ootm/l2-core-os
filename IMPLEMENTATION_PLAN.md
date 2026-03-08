# L2 CORE OS Technical Implementation Plan

**Document Version:** 1.0  
**Created:** 2026-03-07  
**Target System:** L2 CORE OS (Clinic Management & WhatsApp Automation Platform)  
**Architecture:** FastAPI + SQLite + Celery + Redis  

---

## Executive Summary

This document outlines a comprehensive seven-phase implementation plan to extend the L2 CORE OS platform with advanced automation capabilities, multi-clinic support, and enhanced lead scoring. The implementation builds upon the existing foundation of FastAPI, SQLAlchemy, Celery, and WhatsApp integration.

---

## Phase 1: Foundation

### 1.1 AMD GPU Detection Fix

**Objective:** Enhance the `/system/hardware` endpoint to reliably detect AMD GPUs using multiple fallback methods.

**Current Implementation Issues:**

- Uses `wmic` which is deprecated in Windows 11
- Only captures first GPU
- No AMD-specific detection logic

**Implementation:**

```python
# apps/api/services/hardware.py
import platform
import subprocess
import re
from typing import Optional

class HardwareDetector:
    @staticmethod
    def get_gpu_windows() -> dict:
        """Detect GPU using multiple Windows methods."""
        gpu_name = "Unknown"
        gpu_vendor = "unknown"
        
        # Method 1: Try modern PowerShell Get-CimInstance
        try:
            ps_cmd = '''
            $gpu = Get-CimInstance -ClassName Win32_VideoController | 
                   Select-Object -First 1 -Property Name, DriverVersion, AdapterRAM
            $gpu | ConvertTo-Json
            '''
            result = subprocess.run(
                ["powershell", "-Command", ps_cmd],
                capture_output=True,
                text=True,
                timeout=10
            )
            if result.returncode == 0 and result.stdout.strip():
                import json
                data = json.loads(result.stdout)
                gpu_name = data.get("Name", "Unknown")
        except Exception:
            pass
        
        # Method 2: Registry query for display drivers
        if gpu_name == "Unknown":
            try:
                reg_cmd = 'reg query "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}" /v DriverDesc'
                result = subprocess.run(
                    reg_cmd,
                    shell=True,
                    capture_output=True,
                    text=True,
                    timeout=5
                )
                match = re.search(r'DriverDesc\s+REG_SZ\s+(.+)', result.stdout)
                if match:
                    gpu_name = match.group(1).strip()
            except Exception:
                pass
        
        # Method 3: DirectX Diagnostic (fallback)
        if gpu_name == "Unknown":
            try:
                dxdiag_cmd = 'dxdiag /t'
                result = subprocess.run(
                    dxdiag_cmd,
                    capture_output=True,
                    text=True,
                    timeout=15
                )
                # Parse dxdiag output for display info
                in_display = False
                for line in result.stdout.split('\n'):
                    if 'Card name:' in line:
                        gpu_name = line.split('Card name:')[-1].strip()
                        break
            except Exception:
                pass
        
        # Method 4: wmic (legacy fallback)
        if gpu_name == "Unknown":
            try:
                result = subprocess.run(
                    "wmic path win32_VideoController get name",
                    shell=True,
                    capture_output=True,
                    text=True,
                    timeout=5
                )
                lines = [l.strip() for l in result.stdout.split('\n') if l.strip()]
                if len(lines) > 1:
                    gpu_name = lines[1]
            except Exception:
                pass
        
        # Determine vendor
        gpu_lower = gpu_name.lower()
        if any(x in gpu_lower for x in ['amd', 'radeon', 'ati']):
            gpu_vendor = "amd"
        elif 'nvidia' in gpu_lower:
            gpu_vendor = "nvidia"
        elif 'intel' in gpu_lower:
            gpu_vendor = "intel"
        
        return {
            "name": gpu_name,
            "vendor": gpu_vendor,
            "detection_methods_used": ["powershell", "registry", "dxdiag", "wmic"]
        }
    
    @staticmethod
    def get_gpu_linux() -> dict:
        """Detect GPU on Linux systems."""
        gpu_name = "Unknown"
        gpu_vendor = "unknown"
        
        # Try lspci
        try:
            result = subprocess.run(
                ["lspci", "-vnn"],
                capture_output=True,
                text=True,
                timeout=5
            )
            for line in result.stdout.split('\n'):
                if 'VGA' in line or 'Display' in line:
                    gpu_name = line.split(':')[-1].strip()
                    break
        except Exception:
            pass
        
        # Try /sys/class/drm
        if gpu_name == "Unknown":
            try:
                for f in Path("/sys/class/drm").glob("card*/device/name"):
                    gpu_name = f.read_text().strip()
                    break
            except Exception:
                pass
        
        # Determine vendor
        gpu_lower = gpu_name.lower()
        if any(x in gpu_lower for x in ['amd', 'radeon', 'ati']):
            gpu_vendor = "amd"
        elif 'nvidia' in gpu_lower:
            gpu_vendor = "nvidia"
        
        return {"name": gpu_name, "vendor": gpu_vendor}
    
    @staticmethod
    def detect_all() -> dict:
        """Detect all hardware information."""
        os_name = platform.system()
        
        gpu_info = (
            HardwareDetector.get_gpu_windows() 
            if os_name == "Windows" 
            else HardwareDetector.get_gpu_linux()
        )
        
        return {
            "os": os_name,
            "cpu": f"{platform.processor() or 'Unknown'}",
            "cpu_cores": psutil.cpu_count(logical=True),
            "ram_physical_gb": round(psutil.virtual_memory().total / (1024**3), 2),
            "gpu": gpu_info
        }
```

**API Endpoint Update:**

```python
# In main.py, update the system/hardware endpoint
@app.get("/system/hardware")
def system_hardware_scan(_claims: dict = Depends(require_roles({"owner", "operator"}))):
    from services.hardware import HardwareDetector
    return HardwareDetector.detect_all()
```

**Testing Strategy:**

- Unit test each detection method individually
- Test on Windows 10, Windows 11, and Linux (Ubuntu/Debian)
- Test with various GPU configurations (NVIDIA only, AMD only, Intel+NVIDIA, etc.)

---

### 1.2 Database Schema Extensions

**Objective:** Add tables for automation rules, reminders, WhatsApp templates, and document templates. Extend entities with clinic_id, lead_score, and tags.

**SQL Migrations:**

```sql
-- Migration: 2026_03_07_phase1_schema_extensions.sql

-- 1. Add new columns to entities table
ALTER TABLE entities ADD COLUMN IF NOT EXISTS clinic_id TEXT;
ALTER TABLE entities ADD COLUMN IF NOT EXISTS lead_score INTEGER DEFAULT 0;
ALTER TABLE entities ADD COLUMN IF NOT EXISTS tags TEXT DEFAULT '[]';

-- 2. Automation Rules Table
CREATE TABLE IF NOT EXISTS automation_rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    trigger_type TEXT NOT NULL,
    trigger_config JSON NOT NULL,
    conditions JSON NOT NULL DEFAULT '[]',
    actions JSON NOT NULL DEFAULT '[]',
    is_active BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 0,
    clinic_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_triggered_at TEXT,
    execution_count INTEGER DEFAULT 0
);

-- 3. Reminders Table
CREATE TABLE IF NOT EXISTS reminders (
    id TEXT PRIMARY KEY,
    entity_id TEXT NOT NULL,
    event_id TEXT,
    reminder_type TEXT NOT NULL,
    scheduled_for TEXT NOT NULL,
    sent_at TEXT,
    status TEXT DEFAULT 'pending',
    message_template_id TEXT,
    whatsapp_message_id TEXT,
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TEXT NOT NULL,
    clinic_id TEXT,
    FOREIGN KEY (entity_id) REFERENCES entities(id),
    FOREIGN KEY (event_id) REFERENCES events(id)
);

-- 4. WhatsApp Templates Table
CREATE TABLE IF NOT EXISTS whatsapp_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    template_type TEXT NOT NULL,
    content TEXT NOT NULL,
    variables JSON NOT NULL DEFAULT '[]',
    is_active BOOLEAN DEFAULT TRUE,
    clinic_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 5. Document Templates Table
CREATE TABLE IF NOT EXISTS document_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    kind TEXT NOT NULL,
    title_template TEXT NOT NULL,
    body_template TEXT NOT NULL,
    variables JSON NOT NULL DEFAULT '[]',
    is_active BOOLEAN DEFAULT TRUE,
    clinic_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 6. Automation Execution Log Table
CREATE TABLE IF NOT EXISTS automation_executions (
    id TEXT PRIMARY KEY,
    rule_id TEXT NOT NULL,
    trigger_type TEXT NOT NULL,
    entity_id TEXT,
    event_id TEXT,
    conditions_met BOOLEAN,
    actions_executed JSON NOT NULL DEFAULT '[]',
    status TEXT NOT NULL,
    error_message TEXT,
    execution_time_ms INTEGER,
    created_at TEXT NOT NULL,
    FOREIGN KEY (rule_id) REFERENCES automation_rules(id),
    FOREIGN KEY (entity_id) REFERENCES entities(id),
    FOREIGN KEY (event_id) REFERENCES events(id)
);

-- 7. Clinics Table (for Phase 6)
CREATE TABLE IF NOT EXISTS clinics (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    timezone TEXT DEFAULT 'America/Sao_Paulo',
    settings JSON DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 8. Users Table Extension
ALTER TABLE users ADD COLUMN IF NOT EXISTS clinic_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_clinic_admin BOOLEAN DEFAULT FALSE;

-- 9. Create indexes
CREATE INDEX IF NOT EXISTS idx_automation_rules_clinic ON automation_rules(clinic_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_trigger ON automation_rules(trigger_type);
CREATE INDEX IF NOT EXISTS idx_reminders_entity ON reminders(entity_id);
CREATE INDEX IF NOT EXISTS idx_reminders_scheduled ON reminders(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders(status);
CREATE INDEX IF NOT EXISTS idx_entities_clinic ON entities(clinic_id);
CREATE INDEX IF NOT EXISTS idx_entities_lead_score ON entities(lead_score);
CREATE INDEX IF NOT EXISTS idx_executions_rule ON automation_executions(rule_id);
```

**Pydantic Models:**

```python
# apps/api/models/automation.py
from pydantic import BaseModel, Field
from typing import Any
from enum import Enum
from datetime import datetime

class TriggerType(str, Enum):
    EVENT_CREATED = "event_created"
    EVENT_STATUS_CHANGE = "event_status_change"
    EVENT_REMINDER_24H = "event_reminder_24h"
    MESSAGE_RECEIVED = "message_received"
    SCHEDULED = "scheduled"
    MANUAL = "manual"

class ConditionType(str, Enum):
    ENTITY_TYPE = "entity_type"
    ENTITY_TAGS = "entity_tags"
    EVENT_STATUS = "event_status"
    LEAD_SCORE_MIN = "lead_score_min"
    TIME_RANGE = "time_range"
    DAY_OF_WEEK = "day_of_week"

class ActionType(str, Enum):
    SEND_WHATSAPP = "send_whatsapp"
    UPDATE_EVENT_STATUS = "update_event_status"
    CREATE_REMINDER = "create_reminder"
    CREATE_TASK = "create_task"
    UPDATE_ENTITY = "update_entity"
    WEBHOOK = "webhook"

class TriggerConfig(BaseModel):
    """Configuration for trigger types."""
    # For EVENT_STATUS_CHANGE
    from_status: list[str] | None = None
    to_status: list[str] | None = None
    
    # For SCHEDULED
    cron_expression: str | None = None
    interval_minutes: int | None = None
    
    # For EVENT_REMINDER_24H
    hours_before: int | None = None
    
    # For MESSAGE_RECEIVED
    intent_filter: list[str] | None = None

class ConditionConfig(BaseModel):
    """Configuration for condition types."""
    # For ENTITY_TYPE
    allowed_types: list[str] | None = None
    
    # For ENTITY_TAGS
    required_tags: list[str] | None = None
    require_all_tags: bool = False
    
    # For EVENT_STATUS
    required_status: list[str] | None = None
    
    # For LEAD_SCORE_MIN
    min_score: int = 0
    max_score: int | None = None
    
    # For TIME_RANGE
    start_hour: int | None = None
    end_hour: int | None = None
    
    # For DAY_OF_WEEK
    allowed_days: list[int] | None = None  # 0=Monday, 6=Sunday

class ActionConfig(BaseModel):
    """Configuration for action types."""
    action_type: ActionType
    
    # For SEND_WHATSAPP
    template_name: str | None = None
    template_variables: dict[str, Any] | None = None
    
    # For UPDATE_EVENT_STATUS
    new_status: str | None = None
    
    # For CREATE_REMINDER
    reminder_type: str | None = None
    remind_in_hours: int | None = None
    
    # For CREATE_TASK
    task_title: str | None = None
    task_description: str | None = None
    assign_to: str | None = None
    
    # For UPDATE_ENTITY
    update_fields: dict[str, Any] | None = None
    
    # For WEBHOOK
    webhook_url: str | None = None
    webhook_method: str = "POST"
    webhook_headers: dict[str, str] | None = None

class AutomationRuleCreate(BaseModel):
    name: str
    description: str | None = None
    trigger_type: TriggerType
    trigger_config: dict[str, Any]
    conditions: list[dict[str, Any]] = Field(default_factory=list)
    actions: list[dict[str, Any]] = Field(default_factory=list)
    is_active: bool = True
    priority: int = 0
    clinic_id: str | None = None

class AutomationRuleUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    trigger_type: TriggerType | None = None
    trigger_config: dict[str, Any] | None = None
    conditions: list[dict[str, Any]] | None = None
    actions: list[dict[str, Any]] | None = None
    is_active: bool | None = None
    priority: int | None = None

class AutomationRuleResponse(BaseModel):
    id: str
    name: str
    description: str | None
    trigger_type: str
    trigger_config: dict[str, Any]
    conditions: list[dict[str, Any]]
    actions: list[dict[str, Any]]
    is_active: bool
    priority: int
    clinic_id: str | None
    created_at: str
    updated_at: str
    last_triggered_at: str | None
    execution_count: int
```

```python
# apps/api/models/reminders.py
from pydantic import BaseModel, Field
from typing import Any
from enum import Enum

class ReminderType(str, Enum):
    REMINDER_24H = "reminder_24h"
    REMINDER_2H = "reminder_2h"
    CONFIRMATION = "confirmation"
    FOLLOWUP = "followup"
    CUSTOM = "custom"

class ReminderStatus(str, Enum):
    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"
    CANCELED = "canceled"

class ReminderCreate(BaseModel):
    entity_id: str
    event_id: str | None = None
    reminder_type: ReminderType
    scheduled_for: str  # ISO datetime
    message_template_id: str | None = None
    clinic_id: str | None = None

class ReminderUpdate(BaseModel):
    scheduled_for: str | None = None
    status: ReminderStatus | None = None
    message_template_id: str | None = None

class ReminderResponse(BaseModel):
    id: str
    entity_id: str
    event_id: str | None
    reminder_type: str
    scheduled_for: str
    sent_at: str | None
    status: str
    message_template_id: str | None
    whatsapp_message_id: str | None
    retry_count: int
    error_message: str | None
    created_at: str
    clinic_id: str | None
```

```python
# apps/api/models/templates.py
from pydantic import BaseModel, Field
from typing import Any

class WhatsAppTemplateCreate(BaseModel):
    name: str
    template_type: str
    content: str
    variables: list[str] = Field(default_factory=list)
    is_active: bool = True
    clinic_id: str | None = None

class WhatsAppTemplateUpdate(BaseModel):
    name: str | None = None
    template_type: str | None = None
    content: str | None = None
    variables: list[str] | None = None
    is_active: bool | None = None

class WhatsAppTemplateResponse(BaseModel):
    id: str
    name: str
    template_type: str
    content: str
    variables: list[str]
    is_active: bool
    clinic_id: str | None
    created_at: str
    updated_at: str

class DocumentTemplateCreate(BaseModel):
    name: str
    kind: str
    title_template: str
    body_template: str
    variables: list[str] = Field(default_factory=list)
    is_active: bool = True
    clinic_id: str | None = None

class DocumentTemplateUpdate(BaseModel):
    name: str | None = None
    kind: str | None = None
    title_template: str | None = None
    body_template: str | None = None
    variables: list[str] | None = None
    is_active: bool | None = None

class DocumentTemplateResponse(BaseModel):
    id: str
    name: str
    kind: str
    title_template: str
    body_template: str
    variables: list[str]
    is_active: bool
    clinic_id: str | None
    created_at: str
    updated_at: str
```

---

### 1.3 New API Endpoints

**Automation Rules CRUD:**

```python
# In main.py - Automation Rules Endpoints

@app.post("/automation/rules", response_model=dict)
def automation_rule_create(
    req: AutomationRuleCreate,
    _claims: dict = Depends(require_roles({"owner", "operator"}))
):
    rule_id = str(uuid.uuid4())
    ts = now_iso()
    with engine.begin() as conn:
        conn.execute(text("""
            INSERT INTO automation_rules 
            (id, name, description, trigger_type, trigger_config, conditions, actions, 
             is_active, priority, clinic_id, created_at, updated_at)
            VALUES (:id, :name, :desc, :tt, :tc, :cond, :act, :active, :prio, :clinic, :created, :updated)
        """), {
            "id": rule_id,
            "name": req.name,
            "desc": req.description,
            "tt": req.trigger_type.value,
            "tc": json.dumps(req.trigger_config),
            "cond": json.dumps(req.conditions),
            "act": json.dumps(req.actions),
            "active": req.is_active,
            "prio": req.priority,
            "clinic": req.clinic_id,
            "created": ts,
            "updated": ts
        })
    return {"ok": True, "id": rule_id}

@app.get("/automation/rules", response_model=dict)
def automation_rules_list(
    is_active: bool | None = None,
    trigger_type: str | None = None,
    clinic_id: str | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    _claims: dict = Depends(require_roles({"owner", "operator", "viewer"}))
):
    sql = "SELECT * FROM automation_rules WHERE 1=1"
    params = {"limit": limit}
    
    if is_active is not None:
        sql += " AND is_active = :active"
        params["active"] = is_active
    if trigger_type:
        sql += " AND trigger_type = :tt"
        params["tt"] = trigger_type
    if clinic_id:
        sql += " AND clinic_id = :clinic"
        params["clinic"] = clinic_id
    
    sql += " ORDER BY priority DESC, created_at DESC LIMIT :limit"
    
    with engine.begin() as conn:
        rows = conn.execute(text(sql), params).mappings().all()
    return {"ok": True, "items": [dict(r) for r in rows]}

@app.get("/automation/rules/{rule_id}", response_model=dict)
def automation_rule_get(
    rule_id: str,
    _claims: dict = Depends(require_roles({"owner", "operator", "viewer"}))
):
    with engine.begin() as conn:
        row = conn.execute(
            text("SELECT * FROM automation_rules WHERE id = :id"),
            {"id": rule_id}
        ).fetchone()
    
    if not row:
        raise HTTPException(status_code=404, detail="rule_not_found")
    
    return {"ok": True, "item": dict(row._mapping)}

@app.put("/automation/rules/{rule_id}", response_model=dict)
def automation_rule_update(
    rule_id: str,
    req: AutomationRuleUpdate,
    _claims: dict = Depends(require_roles({"owner", "operator"}))
):
    updates = []
    params = {"id": rule_id, "updated": now_iso()}
    
    if req.name is not None:
        updates.append("name = :name")
        params["name"] = req.name
    if req.description is not None:
        updates.append("description = :desc")
        params["desc"] = req.description
    if req.trigger_type is not None:
        updates.append("trigger_type = :tt")
        params["tt"] = req.trigger_type.value
    if req.trigger_config is not None:
        updates.append("trigger_config = :tc")
        params["tc"] = json.dumps(req.trigger_config)
    if req.conditions is not None:
        updates.append("conditions = :cond")
        params["cond"] = json.dumps(req.conditions)
    if req.actions is not None:
        updates.append("actions = :act")
        params["act"] = json.dumps(req.actions)
    if req.is_active is not None:
        updates.append("is_active = :active")
        params["active"] = req.is_active
    if req.priority is not None:
        updates.append("priority = :prio")
        params["prio"] = req.priority
    
    if not updates:
        raise HTTPException(status_code=400, detail="no_updates")
    
    updates.append("updated_at = :updated")
    
    with engine.begin() as conn:
        conn.execute(
            text(f"UPDATE automation_rules SET {', '.join(updates)} WHERE id = :id"),
            params
        )
    
    return {"ok": True, "updated": True}

@app.delete("/automation/rules/{rule_id}", response_model=dict)
def automation_rule_delete(
    rule_id: str,
    _claims: dict = Depends(require_roles({"owner"}))
):
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM automation_rules WHERE id = :id"), {"id": rule_id})
    return {"ok": True, "deleted": rule_id}

@app.post("/automation/rules/{rule_id}/trigger", response_model=dict)
def automation_rule_trigger(
    rule_id: str,
    payload: dict | None = None,
    _claims: dict = Depends(require_roles({"owner", "operator"}))
):
    """Manually trigger an automation rule."""
    from services.automation_engine import AutomationEngine
    
    with engine.begin() as conn:
        row = conn.execute(
            text("SELECT * FROM automation_rules WHERE id = :id AND is_active = true"),
            {"id": rule_id}
        ).fetchone()
    
    if not row:
        raise HTTPException(status_code=404, detail="active_rule_not_found")
    
    engine_svc = AutomationEngine(engine)
    result = engine_svc.execute_rule(row, payload or {})
    
    return {"ok": True, "result": result}
```

**Reminders CRUD:**

```python
# In main.py - Reminders Endpoints

@app.post("/reminders", response_model=dict)
def reminder_create(
    req: ReminderCreate,
    _claims: dict = Depends(require_roles({"owner", "operator"}))
):
    reminder_id = str(uuid.uuid4())
    ts = now_iso()
    
    with engine.begin() as conn:
        conn.execute(text("""
            INSERT INTO reminders 
            (id, entity_id, event_id, reminder_type, scheduled_for, status, 
             message_template_id, clinic_id, created_at)
            VALUES (:id, :entity, :event, :type, :sched, :status, :template, :clinic, :created)
        """), {
            "id": reminder_id,
            "entity": req.entity_id,
            "event": req.event_id,
            "type": req.reminder_type.value,
            "sched": req.scheduled_for,
            "status": "pending",
            "template": req.message_template_id,
            "clinic": req.clinic_id,
            "created": ts
        })
    
    return {"ok": True, "id": reminder_id}

@app.get("/reminders", response_model=dict)
def reminders_list(
    status: ReminderStatus | None = None,
    entity_id: str | None = None,
    clinic_id: str | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    _claims: dict = Depends(require_roles({"owner", "operator", "viewer"}))
):
    sql = "SELECT * FROM reminders WHERE 1=1"
    params = {"limit": limit}
    
    if status:
        sql += " AND status = :status"
        params["status"] = status.value
    if entity_id:
        sql += " AND entity_id = :entity"
        params["entity"] = entity_id
    if clinic_id:
        sql += " AND clinic_id = :clinic"
        params["clinic"] = clinic_id
    
    sql += " ORDER BY scheduled_for ASC LIMIT :limit"
    
    with engine.begin() as conn:
        rows = conn.execute(text(sql), params).mappings().all()
    return {"ok": True, "items": [dict(r) for r in rows]}

@app.get("/reminders/{reminder_id}", response_model=dict)
def reminder_get(
    reminder_id: str,
    _claims: dict = Depends(require_roles({"owner", "operator", "viewer"}))
):
    with engine.begin() as conn:
        row = conn.execute(
            text("SELECT * FROM reminders WHERE id = :id"),
            {"id": reminder_id}
        ).fetchone()
    
    if not row:
        raise HTTPException(status_code=404, detail="reminder_not_found")
    
    return {"ok": True, "item": dict(row._mapping)}

@app.delete("/reminders/{reminder_id}", response_model=dict)
def reminder_delete(
    reminder_id: str,
    _claims: dict = Depends(require_roles({"owner", "operator"}))
):
    with engine.begin() as conn:
        conn.execute(
            text("UPDATE reminders SET status = 'canceled' WHERE id = :id"),
            {"id": reminder_id}
        )
    return {"ok": True, "deleted": reminder_id}
```

**WhatsApp Templates CRUD:**

```python
# In main.py - WhatsApp Templates Endpoints

@app.post("/whatsapp/templates", response_model=dict)
def whatsapp_template_create(
    req: WhatsAppTemplateCreate,
    _claims: dict = Depends(require_roles({"owner", "operator"}))
):
    template_id = str(uuid.uuid4())
    ts = now_iso()
    
    with engine.begin() as conn:
        conn.execute(text("""
            INSERT INTO whatsapp_templates 
            (id, name, template_type, content, variables, is_active, clinic_id, created_at, updated_at)
            VALUES (:id, :name, :type, :content, :vars, :active, :clinic, :created, :updated)
        """), {
            "id": template_id,
            "name": req.name,
            "type": req.template_type,
            "content": req.content,
            "vars": json.dumps(req.variables),
            "active": req.is_active,
            "clinic": req.clinic_id,
            "created": ts,
            "updated": ts
        })
    
    return {"ok": True, "id": template_id}

@app.get("/whatsapp/templates", response_model=dict)
def whatsapp_templates_list(
    template_type: str | None = None,
    is_active: bool | None = None,
    clinic_id: str | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    _claims: dict = Depends(require_roles({"owner", "operator", "viewer"}))
):
    sql = "SELECT * FROM whatsapp_templates WHERE 1=1"
    params = {"limit": limit}
    
    if template_type:
        sql += " AND template_type = :type"
        params["type"] = template_type
    if is_active is not None:
        sql += " AND is_active = :active"
        params["active"] = is_active
    if clinic_id:
        sql += " AND clinic_id = :clinic"
        params["clinic"] = clinic_id
    
    sql += " ORDER BY name ASC LIMIT :limit"
    
    with engine.begin() as conn:
        rows = conn.execute(text(sql), params).mappings().all()
    return {"ok": True, "items": [dict(r) for r in rows]}

@app.get("/whatsapp/templates/{template_id}", response_model=dict)
def whatsapp_template_get(
    template_id: str,
    _claims: dict = Depends(require_roles({"owner", "operator", "viewer"}))
):
    with engine.begin() as conn:
        row = conn.execute(
            text("SELECT * FROM whatsapp_templates WHERE id = :id"),
            {"id": template_id}
        ).fetchone()
    
    if not row:
        raise HTTPException(status_code=404, detail="template_not_found")
    
    return {"ok": True, "item": dict(row._mapping)}

@app.put("/whatsapp/templates/{template_id}", response_model=dict)
def whatsapp_template_update(
    template_id: str,
    req: WhatsAppTemplateUpdate,
    _claims: dict = Depends(require_roles({"owner", "operator"}))
):
    updates = []
    params = {"id": template_id, "updated": now_iso()}
    
    if req.name is not None:
        updates.append("name = :name")
        params["name"] = req.name
    if req.template_type is not None:
        updates.append("template_type = :type")
        params["type"] = req.template_type
    if req.content is not None:
        updates.append("content = :content")
        params["content"] = req.content
    if req.variables is not None:
        updates.append("variables = :vars")
        params["vars"] = json.dumps(req.variables)
    if req.is_active is not None:
        updates.append("is_active = :active")
        params["active"] = req.is_active
    
    if not updates:
        raise HTTPException(status_code=400, detail="no_updates")
    
    updates.append("updated_at = :updated")
    
    with engine.begin() as conn:
        conn.execute(
            text(f"UPDATE whatsapp_templates SET {', '.join(updates)} WHERE id = :id"),
            params
        )
    
    return {"ok": True, "updated": True}

@app.delete("/whatsapp/templates/{template_id}", response_model=dict)
def whatsapp_template_delete(
    template_id: str,
    _claims: dict = Depends(require_roles({"owner"}))
):
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM whatsapp_templates WHERE id = :id"), {"id": template_id})
    return {"ok": True, "deleted": template_id}
```

**Document Templates CRUD:**

```python
# In main.py - Document Templates Endpoints

@app.post("/documents/templates", response_model=dict)
def document_template_create(
    req: DocumentTemplateCreate,
    _claims: dict = Depends(require_roles({"owner", "operator"}))
):
    template_id = str(uuid.uuid4())
    ts = now_iso()
    
    with engine.begin() as conn:
        conn.execute(text("""
            INSERT INTO document_templates 
            (id, name, kind, title_template, body_template, variables, is_active, clinic_id, created_at, updated_at)
            VALUES (:id, :name, :kind, :title, :body, :vars, :active, :clinic, :created, :updated)
        """), {
            "id": template_id,
            "name": req.name,
            "kind": req.kind,
            "title": req.title_template,
            "body": req.body_template,
            "vars": json.dumps(req.variables),
            "active": req.is_active,
            "clinic": req.clinic_id,
            "created": ts,
            "updated": ts
        })
    
    return {"ok": True, "id": template_id}

@app.get("/documents/templates", response_model=dict)
def document_templates_list(
    kind: str | None = None,
    is_active: bool | None = None,
    clinic_id: str | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    _claims: dict = Depends(require_roles({"owner", "operator", "viewer"}))
):
    sql = "SELECT * FROM document_templates WHERE 1=1"
    params = {"limit": limit}
    
    if kind:
        sql += " AND kind = :kind"
        params["kind"] = kind
    if is_active is not None:
        sql += " AND is_active = :active"
        params["active"] = is_active
    if clinic_id:
        sql += " AND clinic_id = :clinic"
        params["clinic"] = clinic_id
    
    sql += " ORDER BY name ASC LIMIT :limit"
    
    with engine.begin() as conn:
        rows = conn.execute(text(sql), params).mappings().all()
    return {"ok": True, "items": [dict(r) for r in rows]}

@app.get("/documents/templates/{template_id}", response_model=dict)
def document_template_get(
    template_id: str,
    _claims: dict = Depends(require_roles({"owner", "operator", "viewer"}))
):
    with engine.begin() as conn:
        row = conn.execute(
            text("SELECT * FROM document_templates WHERE id = :id"),
            {"id": template_id}
        ).fetchone()
    
    if not row:
        raise HTTPException(status_code=404, detail="template_not_found")
    
    return {"ok": True, "item": dict(row._mapping)}

@app.put("/documents/templates/{template_id}", response_model=dict)
def document_template_update(
    template_id: str,
    req: DocumentTemplateUpdate,
    _claims: dict = Depends(require_roles({"owner", "operator"}))
):
    updates = []
    params = {"id": template_id, "updated": now_iso()}
    
    if req.name is not None:
        updates.append("name = :name")
        params["name"] = req.name
    if req.kind is not None:
        updates.append("kind = :kind")
        params["kind"] = req.kind
    if req.title_template is not None:
        updates.append("title_template = :title")
        params["title"] = req.title_template
    if req.body_template is not None:
        updates.append("body_template = :body")
        params["body"] = req.body_template
    if req.variables is not None:
        updates.append("variables = :vars")
        params["vars"] = json.dumps(req.variables)
    if req.is_active is not None:
        updates.append("is_active = :active")
        params["active"] = req.is_active
    
    if not updates:
        raise HTTPException(status_code=400, detail="no_updates")
    
    updates.append("updated_at = :updated")
    
    with engine.begin() as conn:
        conn.execute(
            text(f"UPDATE document_templates SET {', '.join(updates)} WHERE id = :id"),
            params
        )
    
    return {"ok": True, "updated": True}

@app.delete("/documents/templates/{template_id}", response_model=dict)
def document_template_delete(
    template_id: str,
    _claims: dict = Depends(require_roles({"owner"}))
):
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM document_templates WHERE id = :id"), {"id": template_id})
    return {"ok": True, "deleted": template_id}
```

---

## Phase 2: Automation Engine

### 2.1 Core Engine Implementation

```python
# apps/api/services/automation_engine.py
import json
import time
import logging
from typing import Any
from datetime import datetime, timezone, timedelta
from sqlalchemy import text
from sqlalchemy.engine import Engine

logger = logging.getLogger(__name__)

class AutomationEngine:
    """Core automation engine for executing rules based on triggers."""
    
    def __init__(self, engine: Engine):
        self.engine = engine
    
    def evaluate_conditions(
        self, 
        conditions: list[dict], 
        entity_id: str | None = None,
        event_id: str | None = None,
        context: dict | None = None
    ) -> tuple[bool, str]:
        """Evaluate all conditions. Returns (passed, reason)."""
        if not conditions:
            return True, "no_conditions"
        
        for condition in conditions:
            condition_type = condition.get("type")
            config = condition.get("config", {})
            
            passed = self._evaluate_single_condition(
                condition_type, config, entity_id, event_id, context
            )
            
            if not passed:
                return False, f"condition_failed:{condition_type}"
        
        return True, "all_conditions_met"
    
    def _evaluate_single_condition(
        self,
        condition_type: str,
        config: dict,
        entity_id: str | None,
        event_id: str | None,
        context: dict | None
    ) -> bool:
        """Evaluate a single condition."""
        with self.engine.begin() as conn:
            if condition_type == "entity_type":
                if not entity_id:
                    return False
                allowed_types = config.get("allowed_types", [])
                row = conn.execute(
                    text("SELECT type FROM entities WHERE id = :id"),
                    {"id": entity_id}
                ).fetchone()
                return row and row[0] in allowed_types
            
            elif condition_type == "entity_tags":
                if not entity_id:
                    return False
                require_all = config.get("require_all_tags", False)
                required_tags = config.get("required_tags", [])
                row = conn.execute(
                    text("SELECT tags FROM entities WHERE id = :id"),
                    {"id": entity_id}
                ).fetchone()
                
                if not row or not row[0]:
                    return False
                
                entity_tags = json.loads(row[0]) if isinstance(row[0], str) else row[0]
                
                if require_all:
                    return all(tag in entity_tags for tag in required_tags)
                else:
                    return any(tag in entity_tags for tag in required_tags)
            
            elif condition_type == "event_status":
                if not event_id:
                    return False
                required_status = config.get("required_status", [])
                row = conn.execute(
                    text("SELECT status FROM events WHERE id = :id"),
                    {"id": event_id}
                ).fetchone()
                return row and row[0] in required_status
            
            elif condition_type == "lead_score_min":
                if not entity_id:
                    return False
                min_score = config.get("min_score", 0)
                max_score = config.get("max_score")
                row = conn.execute(
                    text("SELECT lead_score FROM entities WHERE id = :id"),
                    {"id": entity_id}
                ).fetchone()
                
                if not row or row[0] is None:
                    return False
                
                score = row[0]
                if score < min_score:
                    return False
                if max_score is not None and score > max_score:
                    return False
                return True
            
            elif condition_type == "time_range":
                start_hour = config.get("start_hour")
                end_hour = config.get("end_hour")
                now = datetime.now(timezone.utc).hour
                
                if start_hour is not None and end_hour is not None:
                    if start_hour <= end_hour:
                        return start_hour <= now < end_hour
                    else:  # Overnight range
                        return now >= start_hour or now < end_hour
                return True
            
            elif condition_type == "day_of_week":
                allowed_days = config.get("allowed_days", [])
                now = datetime.now(timezone.utc).weekday()
                return now in allowed_days
            
            return True
    
    def execute_actions(
        self,
        actions: list[dict],
        entity_id: str | None = None,
        event_id: str | None = None,
        context: dict | None = None
    ) -> list[dict]:
        """Execute all actions. Returns list of results."""
        results = []
        
        for action in actions:
            action_type = action.get("type")
            config = action.get("config", {})
            
            try:
                result = self._execute_single_action(
                    action_type, config, entity_id, event_id, context
                )
                results.append({
                    "action": action_type,
                    "success": True,
                    "result": result
                })
            except Exception as e:
                logger.error(f"Action {action_type} failed: {e}")
                results.append({
                    "action": action_type,
                    "success": False,
                    "error": str(e)
                })
        
        return results
    
    def _execute_single_action(
        self,
        action_type: str,
        config: dict,
        entity_id: str | None,
        event_id: str | None,
        context: dict | None
    ) -> dict:
        """Execute a single action."""
        if action_type == "send_whatsapp":
            return self._action_send_whatsapp(config, entity_id, context)
        
        elif action_type == "update_event_status":
            return self._action_update_event_status(config, event_id)
        
        elif action_type == "create_reminder":
            return self._action_create_reminder(config, entity_id, event_id)
        
        elif action_type == "create_task":
            return self._action_create_task(config, entity_id)
        
        elif action_type == "update_entity":
            return self._action_update_entity(config, entity_id)
        
        elif action_type == "webhook":
            return self._action_webhook(config, entity_id, event_id, context)
        
        raise ValueError(f"Unknown action type: {action_type}")
    
    def _action_send_whatsapp(self, config: dict, entity_id: str, context: dict) -> dict:
        """Send WhatsApp message using template."""
        from services.whatsapp_sender import WhatsAppSender
        
        template_name = config.get("template_name")
        template_vars = config.get("template_variables", {})
        
        # Merge context into template variables
        if context:
            template_vars.update(context)
        
        sender = WhatsAppSender(self.engine)
        message_id = sender.send_from_template(entity_id, template_name, template_vars)
        
        return {"message_id": message_id, "status": "sent"}
    
    def _action_update_event_status(self, config: dict, event_id: str | None) -> dict:
        """Update event status."""
        if not event_id:
            return {"error": "no_event_id"}
        
        new_status = config.get("new_status")
        if not new_status:
            return {"error": "no_new_status"}
        
        ts = datetime.now(timezone.utc).isoformat()
        
        with self.engine.begin() as conn:
            conn.execute(
                text("UPDATE events SET status = :status, updated_at = :updated WHERE id = :id"),
                {"status": new_status, "updated": ts, "id": event_id}
            )
        
        return {"event_id": event_id, "new_status": new_status}
    
    def _action_create_reminder(self, config: dict, entity_id: str, event_id: str | None) -> dict:
        """Create a reminder."""
        import uuid
        
        reminder_type = config.get("reminder_type", "custom")
        remind_in_hours = config.get("remind_in_hours", 24)
        
        scheduled_for = datetime.now(timezone.utc) + timedelta(hours=remind_in_hours)
        
        reminder_id = str(uuid.uuid4())
        ts = datetime.now(timezone.utc).isoformat()
        
        with self.engine.begin() as conn:
            conn.execute(text("""
                INSERT INTO reminders 
                (id, entity_id, event_id, reminder_type, scheduled_for, status, created_at)
                VALUES (:id, :entity, :event, :type, :sched, :status, :created)
            """), {
                "id": reminder_id,
                "entity": entity_id,
                "event": event_id,
                "type": reminder_type,
                "sched": scheduled_for.isoformat(),
                "status": "pending",
                "created": ts
            })
        
        return {"reminder_id": reminder_id, "scheduled_for": scheduled_for.isoformat()}
    
    def _action_create_task(self, config: dict, entity_id: str | None) -> dict:
        """Create a task (human_review_queue entry)."""
        import uuid
        
        task_title = config.get("task_title", "New Task")
        task_description = config.get("task_description", "")
        assign_to = config.get("assign_to")
        
        task_id = str(uuid.uuid4())
        ts = datetime.now(timezone.utc).isoformat()
        
        with self.engine.begin() as conn:
            conn.execute(text("""
                INSERT INTO human_review_queue
                (id, source, reference_id, text, status, created_at)
                VALUES (:id, :source, :ref, :text, :status, :created)
            """), {
                "id": task_id,
                "source": f"automation_task:{assign_to or 'unassigned'}",
                "ref": entity_id,
                "text": f"{task_title}\n{task_description}",
                "status": "pending",
                "created": ts
            })
        
        return {"task_id": task_id, "title": task_title}
    
    def _action_update_entity(self, config: dict, entity_id: str | None) -> dict:
        """Update entity fields."""
        if not entity_id:
            return {"error": "no_entity_id"}
        
        update_fields = config.get("update_fields", {})
        if not update_fields:
            return {"error": "no_update_fields"}
        
        ts = datetime.now(timezone.utc).isoformat()
        
        set_clauses = []
        params = {"id": entity_id, "updated": ts}
        
        for field, value in update_fields.items():
            set_clauses.append(f"{field} = :{field}")
            params[field] = value
        
        set_clauses.append("updated_at = :updated")
        
        with self.engine.begin() as conn:
            conn.execute(
                text(f"UPDATE entities SET {', '.join(set_clauses)} WHERE id = :id"),
                params
            )
        
        return {"entity_id": entity_id, "updated_fields": list(update_fields.keys())}
    
    def _action_webhook(
        self, 
        config: dict, 
        entity_id: str | None, 
        event_id: str | None,
        context: dict | None
    ) -> dict:
        """Execute a webhook call."""
        import urllib.request
        
        webhook_url = config.get("webhook_url")
        method = config.get("webhook_method", "POST")
        headers = config.get("webhook_headers", {})
        
        if not webhook_url:
            return {"error": "no_webhook_url"}
        
        payload = {
            "entity_id": entity_id,
            "event_id": event_id,
            "context": context or {}
        }
        
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            webhook_url,
            data=data,
            headers={"Content-Type": "application/json", **headers},
            method=method
        )
        
        try:
            with urllib.request.urlopen(req, timeout=30) as response:
                return {
                    "status_code": response.status,
                    "response": response.read().decode("utf-8")
                }
        except urllib.error.HTTPError as e:
            return {"error": f"HTTP {e.code}", "message": e.reason}
        except Exception as e:
            return {"error": str(e)}
    
    def execute_rule(
        self, 
        rule_row, 
        context: dict | None = None
    ) -> dict:
        """Execute a complete automation rule."""
        start_time = time.time()
        
        entity_id = context.get("entity_id") if context else None
        event_id = context.get("event_id") if context else None
        
        # Evaluate conditions
        conditions = json.loads(rule_row.conditions) if isinstance(rule_row.conditions, str) else rule_row.conditions
        passed, reason = self.evaluate_conditions(conditions, entity_id, event_id, context)
        
        execution_id = str(uuid.uuid4())
        ts = datetime.now(timezone.utc).isoformat()
        
        if not passed:
            # Log failed execution
            with self.engine.begin() as conn:
                conn.execute(text("""
                    INSERT INTO automation_executions
                    (id, rule_id, trigger_type, entity_id, event_id, conditions_met, status, created_at)
                    VALUES (:id, :rule, :trigger, :entity, :event, false, 'skipped', :created)
                """), {
                    "id": execution_id,
                    "rule": rule_row.id,
                    "trigger": rule_row.trigger_type,
                    "entity": entity_id,
                    "event": event_id,
                    "created": ts
                })
            
            return {
                "execution_id": execution_id,
                "status": "skipped",
                "reason": reason
            }
        
        # Execute actions
        actions = json.loads(rule_row.actions) if isinstance(rule_row.actions, str) else rule_row.actions
        action_results = self.execute_actions(actions, entity_id, event_id, context)
        
        execution_time_ms = int((time.time() - start_time) * 1000)
        
        # Log successful execution
        with self.engine.begin() as conn:
            conn.execute(text("""
                INSERT INTO automation_executions
                (id, rule_id, trigger_type, entity_id, event_id, conditions_met, actions_executed, status, execution_time_ms, created_at)
                VALUES (:id, :rule, :trigger, :entity, :event, true, :actions, 'completed', :time, :created)
            """), {
                "id": execution_id,
                "rule": rule_row.id,
                "trigger": rule_row.trigger_type,
                "entity": entity_id,
                "event": event_id,
                "actions": json.dumps(action_results),
                "time": execution_time_ms,
                "created": ts
            })
            
            # Update rule execution count
            conn.execute(text("""
                UPDATE automation_rules 
                SET execution_count = execution_count + 1, last_triggered_at = :last
                WHERE id = :id
            """), {"last": ts, "id": rule_row.id})
        
        return {
            "execution_id": execution_id,
            "status": "completed",
            "action_results": action_results,
            "execution_time_ms": execution_time_ms
        }
    
    def trigger_event_created(self, entity_id: str, event_id: str):
        """Trigger rules for EVENT_CREATED trigger."""
        with self.engine.begin() as conn:
            rows = conn.execute(text("""
                SELECT * FROM automation_rules 
                WHERE trigger_type = 'event_created' AND is_active = true
                ORDER BY priority DESC
            """)).fetchall()
        
        for row in rows:
            self.execute_rule(row, {"entity_id": entity_id, "event_id": event_id})
    
    def trigger_event_status_change(
        self, 
        entity_id: str, 
        event_id: str, 
        old_status: str, 
        new_status: str
    ):
        """Trigger rules for EVENT_STATUS_CHANGE trigger."""
        with self.engine.begin() as conn:
            rows = conn.execute(text("""
                SELECT * FROM automation_rules 
                WHERE trigger_type = 'event_status_change' AND is_active = true
                ORDER BY priority DESC
            """)).fetchall()
        
        for row in rows:
            trigger_config = (
                json.loads(row.trigger_config) 
                if isinstance(row.trigger_config, str) 
                else row.trigger_config
            )
            
            from_status = trigger_config.get("from_status", [])
            to_status = trigger_config.get("to_status", [])
            
            # Check if status change matches config
            if from_status and old_status not in from_status:
                continue
            if to_status and new_status not in to_status:
                continue
            
            self.execute_rule(row, {
                "entity_id": entity_id,
                "event_id": event_id,
                "old_status": old_status,
                "new_status": new_status
            })
    
    def trigger_message_received(self, entity_id: str, message_text: str, intent: str):
        """Trigger rules for MESSAGE_RECEIVED trigger."""
        with self.engine.begin() as conn:
            rows = conn.execute(text("""
                SELECT * FROM automation_rules 
                WHERE trigger_type = 'message_received' AND is_active = true
                ORDER BY priority DESC
            """)).fetchall()
        
        for row in rows:
            trigger_config = (
                json.loads(row.trigger_config) 
                if isinstance(row.trigger_config, str) 
                else row.trigger_config
            )
            
            intent_filter = trigger_config.get("intent_filter")
            if intent_filter and intent not in intent_filter:
                continue
            
            self.execute_rule(row, {
                "entity_id": entity_id,
                "message_text": message_text,
                "intent": intent
            })
```

---

## Phase 3: WhatsApp Reminders

### 3.1 Default Message Templates

```sql
-- Insert default WhatsApp templates
INSERT INTO whatsapp_templates (id, name, template_type, content, variables, is_active, created_at, updated_at) VALUES
('wtpl_reminder_24h', 'reminder_24h', 'reminder', 'Olá {{name}}! Lembrando que você tem uma consulta agendada para amanhã às {{time}}. Por favor, confirme ou cancele.', '["name", "time"]', true, datetime('now'), datetime('now')),
('wtpl_reminder_2h', 'reminder_2h', 'reminder', 'Olá {{name}}! Sua consulta está marcada para as {{time}} (em 2 horas). Nos vemos em breve!', '["name", "time"]', true, datetime('now'), datetime('now')),
('wtpl_confirmed', 'confirmed', 'confirmation', '太好了！Sua consulta foi confirmada para {{date}} às {{time}}. Estamos te esperando!', '["date", "time"]', true, datetime('now'), datetime('now')),
('wtpl_canceled', 'canceled', 'confirmation', 'Entendemos que você precisará cancelar. Sua consulta foi cancelada. Se precisar remarcar, é só falar!', '[]', true, datetime('now'), datetime('now')),
('wtpl_noshow', 'noshow', 'followup', 'Olá {{name}}, notamos que você não compareceu à consulta hoje. Gostaria de remarcar?', '["name"]', true, datetime('now'), datetime('now')),
('wtpl_auto_reply', 'auto_reply', 'auto_reply', 'Olá! Obrigado por entrar em contato. Em breve retornaremos sua mensagem.', '[]', true, datetime('now'), datetime('now'));
```

### 3.2 Reminder Celery Tasks

```python
# apps/api/worker.py (Extended)
from celery import Celery
from celery.schedules import crontab
import os
import json
import time
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
celery_app = Celery("l2core", broker=REDIS_URL, backend=REDIS_URL)

celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    beat_schedule={
        'check-pending-reminders': {
            'task': 'tasks.check_pending_reminders',
            'schedule': crontab(minute='*/5'),  # Every 5 minutes
        },
        'process-scheduled-triggers': {
            'task': 'tasks.process_scheduled_triggers',
            'schedule': crontab(minute='*'),  # Every minute
        },
    }
)

@celery_app.task(bind=True, autoretry_for=(Exception,), retry_backoff=True, max_retries=3)
def check_pending_reminders(self):
    """Check for pending reminders and send them."""
    from sqlalchemy import create_engine, text
    from sqlalchemy.pool import StaticPool
    
    database_url = os.getenv("DATABASE_URL", "sqlite:///./l2core.db")
    engine = create_engine(database_url, poolclass=StaticPool)
    
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(minutes=5)
    window_end = now + timedelta(minutes=5)
    
    with engine.begin() as conn:
        rows = conn.execute(text("""
            SELECT r.*, e.full_name, e.contact_phone, ev.scheduled_for
            FROM reminders r
            JOIN entities e ON e.id = r.entity_id
            LEFT JOIN events ev ON ev.id = r.event_id
            WHERE r.status = 'pending'
              AND r.scheduled_for >= :window_start
              AND r.scheduled_for <= :window_end
            ORDER BY r.scheduled_for ASC
        """), {
            "window_start": window_start.isoformat(),
            "window_end": window_end.isoformat()
        }).fetchall()
    
    results = []
    for row in rows:
        reminder = dict(row._mapping) if hasattr(row, '_mapping') else dict(zip(row.keys(), row))
        
        try:
            message_id = send_whatsapp_reminder(reminder)
            
            with engine.begin() as conn:
                conn.execute(text("""
                    UPDATE reminders 
                    SET status = 'sent', sent_at = :sent, whatsapp_message_id = :msg_id
                    WHERE id = :id
                """), {
                    "sent": now.isoformat(),
                    "msg_id": message_id,
                    "id": reminder["id"]
                })
            
            results.append({"reminder_id": reminder["id"], "status": "sent", "message_id": message_id})
            
        except Exception as e:
            retry_count = reminder.get("retry_count", 0) + 1
            
            with engine.begin() as conn:
                conn.execute(text("""
                    UPDATE reminders 
                    SET status = :new_status, retry_count = :retry, error_message = :error
                    WHERE id = :id
                """), {
                    "new_status": "failed" if retry_count >= 3 else "pending",
                    "retry": retry_count,
                    "error": str(e),
                    "id": reminder["id"]
                })
            
            results.append({"reminder_id": reminder["id"], "status": "failed", "error": str(e)})
            
            if retry_count < 3:
                # Schedule retry in 5 minutes
                check_pending_reminders.apply_async(
                    args=[reminder["id"]],
                    countdown=300
                )
    
    return {"processed": len(results), "results": results}


def send_whatsapp_reminder(reminder: dict) -> str:
    """Send WhatsApp message for a reminder."""
    import urllib.request
    
    # Get template content
    from sqlalchemy import create_engine, text
    from sqlalchemy.pool import StaticPool
    
    database_url = os.getenv("DATABASE_URL", "sqlite:///./l2core.db")
    engine = create_engine(database_url, poolclass=StaticPool)
    
    template_name = f"reminder_{reminder['reminder_type']}"
    
    with engine.begin() as conn:
        row = conn.execute(text("""
            SELECT content, variables FROM whatsapp_templates 
            WHERE name = :name AND is_active = true
        """), {"name": template_name}).fetchone()
    
    if not row:
        raise ValueError(f"Template not found: {template_name}")
    
    template_content = row[0]
    template_vars = json.loads(row[1]) if row[1] else []
    
    # Resolve variables
    variables = {}
    for var in template_vars:
        if var == "name":
            variables[var] = reminder.get("full_name", "Cliente")
        elif var == "time":
            scheduled = reminder.get("scheduled_for")
            if scheduled:
                dt = datetime.fromisoformat(scheduled.replace("Z", "+00:00"))
                variables[var] = dt.strftime("%H:%M")
            else:
                variables[var] = ""
        elif var == "date":
            scheduled = reminder.get("scheduled_for")
            if scheduled:
                dt = datetime.fromisoformat(scheduled.replace("Z", "+00:00"))
                variables[var] = dt.strftime("%d/%m/%Y")
            else:
                variables[var] = ""
    
    # Replace variables in template
    message_text = template_content
    for var, value in variables.items():
        message_text = message_text.replace(f"{{{{{var}}}}}", str(value))
    
    # Send via Baileys webhook
    phone = reminder.get("contact_phone", "")
    if not phone:
        raise ValueError("No phone number for reminder")
    
    # Ensure phone has country code
    if not phone.startswith("+"):
        phone = "+" + phone
    
    # Call WhatsApp sender service
    whatsapp_api_url = os.getenv("WHATSAPP_API_URL", "http://localhost:8090")
    
    payload = {
        "phone": phone,
        "text": message_text
    }
    
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{whatsapp_api_url}/message/text",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    
    with urllib.request.urlopen(req, timeout=30) as response:
        result = json.loads(response.read().decode("utf-8"))
        return result.get("message_id", str(uuid.uuid4()))


@celery_app.task(bind=True)
def process_scheduled_triggers(self):
    """Process scheduled automation triggers."""
    from sqlalchemy import create_engine, text
    from sqlalchemy.pool import StaticPool
    
    database_url = os.getenv("DATABASE_URL", "sqlite:///./l2core.db")
    engine = create_engine(database_url, poolclass=StaticPool)
    
    from services.automation_engine import AutomationEngine
    engine_svc = AutomationEngine(engine)
    
    now = datetime.now(timezone.utc)
    
    with engine.begin() as conn:
        rows = conn.execute(text("""
            SELECT * FROM automation_rules 
            WHERE trigger_type = 'scheduled' AND is_active = true
        """)).fetchall()
    
    results = []
    for row in rows:
        rule = dict(row._mapping) if hasattr(row, '_mapping') else dict(zip(row.keys(), row))
        
        trigger_config = json.loads(rule["trigger_config"]) if isinstance(rule["trigger_config"], str) else rule["trigger_config"]
        interval_minutes = trigger_config.get("interval_minutes")
        
        if not interval_minutes:
            continue
        
        last_triggered = rule.get("last_triggered_at")
        
        should_trigger = False
        if not last_triggered:
            should_trigger = True
        else:
            last_dt = datetime.fromisoformat(last_triggered.replace("Z", "+00:00"))
            next_trigger = last_dt + timedelta(minutes=interval_minutes)
            should_trigger = now >= next_trigger
        
        if should_trigger:
            result = engine_svc.execute_rule(row, {"scheduled": True})
            results.append({"rule_id": rule["id"], "result": result})
    
    return {"processed": len(results), "results": results}


@celery_app.task(bind=True, autoretry_for=(Exception,), retry_backoff=True, max_retries=5)
def send_scheduled_whatsapp(self, reminder_id: str):
    """Send a specific scheduled WhatsApp message."""
    from sqlalchemy import create_engine, text
    from sqlalchemy.pool import StaticPool
    
    database_url = os.getenv("DATABASE_URL", "sqlite:///./l2core.db")
    engine = create_engine(database_url, poolclass=StaticPool)
    
    with engine.begin() as conn:
        row = conn.execute(text("""
            SELECT r.*, e.full_name, e.contact_phone, ev.scheduled_for
            FROM reminders r
            JOIN entities e ON e.id = r.entity_id
            LEFT JOIN events ev ON ev.id = r.event_id
            WHERE r.id = :id
        """), {"id": reminder_id}).fetchone()
    
    if not row:
        raise ValueError(f"Reminder not found: {reminder_id}")
    
    reminder = dict(row._mapping) if hasattr(row, '_mapping') else dict(zip(row.keys(), row))
    
    message_id = send_whatsapp_reminder(reminder)
    
    now = datetime.now(timezone.utc).isoformat()
    
    with engine.begin() as conn:
        conn.execute(text("""
            UPDATE reminders 
            SET status = 'sent', sent_at = :sent, whatsapp_message_id = :msg_id
            WHERE id = :id
        """), {
            "sent": now,
            "msg_id": message_id,
            "id": reminder_id
        })
    
    return {"reminder_id": reminder_id, "message_id": message_id}
```

---

## Phase 4: Auto-Reply for Unknown Leads

### 4.1 Configuration Options

```python
# Add to app_settings schema
# Configuration keys:
# - auto_reply_unknown_enabled: bool (default: false)
# - auto_reply_unknown_template: str (default: "auto_reply")
# - auto_reply_unknown_delay_seconds: int (default: 5)
# - auto_reply_unknown_max_per_day: int (default: 1)
```

### 4.2 AutoReplyService Implementation

```python
# apps/api/services/auto_reply_service.py
import json
import os
from datetime import datetime, timezone, timedelta
from typing import Any
from sqlalchemy import text
from sqlalchemy.engine import Engine

class AutoReplyService:
    """Service for handling auto-reply to unknown leads."""
    
    def __init__(self, engine: Engine):
        self.engine = engine
    
    def get_config(self) -> dict[str, Any]:
        """Get auto-reply configuration."""
        with self.engine.begin() as conn:
            rows = conn.execute(text("""
                SELECT key, value FROM app_settings 
                WHERE key LIKE 'auto_reply_%'
            """)).fetchall()
        
        config = {
            "auto_reply_unknown_enabled": False,
            "auto_reply_unknown_template": "auto_reply",
            "auto_reply_unknown_delay_seconds": 5,
            "auto_reply_unknown_max_per_day": 1
        }
        
        for row in rows:
            key = row[0]
            value = row[1]
            try:
                config[key] = json.loads(value)
            except:
                config[key] = value
        
        return config
    
    def should_auto_reply(self, phone: str) -> tuple[bool, str]:
        """Check if auto-reply should be sent to this phone."""
        config = self.get_config()
        
        if not config.get("auto_reply_unknown_enabled"):
            return False, "disabled"
        
        # Check rate limit per phone
        today = datetime.now(timezone.utc).date().isoformat()
        
        with self.engine.begin() as conn:
            row = conn.execute(text("""
                SELECT COUNT(*) FROM inbound_messages 
                WHERE phone = :phone 
                  AND received_at LIKE :today
                  AND text LIKE '%[AUTO-REPLY]%'
            """), {"phone": phone, "today": f"{today}%"}).fetchone()
        
        sent_today = row[0] if row else 0
        max_per_day = config.get("auto_reply_unknown_max_per_day", 1)
        
        if sent_today >= max_per_day:
            return False, "rate_limit_exceeded"
        
        return True, "allowed"
    
    def send_auto_reply(self, phone: str, entity_id: str | None = None) -> dict:
        """Send auto-reply to unknown lead."""
        config = self.get_config()
        
        template_name = config.get("auto_reply_unknown_template", "auto_reply")
        
        with self.engine.begin() as conn:
            # Get template content
            row = conn.execute(text("""
                SELECT content FROM whatsapp_templates 
                WHERE name = :name AND is_active = true
            """), {"name": template_name}).fetchone()
        
        if not row:
            return {"success": False, "error": "template_not_found"}
        
        message_text = row[0]
        
        # If we have an entity_id, try to personalize
        if entity_id:
            entity_row = conn.execute(text("""
                SELECT full_name FROM entities WHERE id = :id
            """), {"id": entity_id}).fetchone()
            
            if entity_row and entity_row[0]:
                message_text = message_text.replace("{{name}}", entity_row[0])
        
        # Send the message
        return self._send_whatsapp_message(phone, message_text)
    
    def _send_whatsapp_message(self, phone: str, text: str) -> dict:
        """Send WhatsApp message via API."""
        import urllib.request
        import uuid
        
        # Ensure phone has country code
        if not phone.startswith("+"):
            phone = "+" + phone
        
        whatsapp_api_url = os.getenv("WHATSAPP_API_URL", "http://localhost:8090")
        
        payload = {
            "phone": phone,
            "text": f"[AUTO-REPLY] {text}"
        }
        
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            f"{whatsapp_api_url}/message/text",
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        
        try:
            with urllib.request.urlopen(req, timeout=30) as response:
                result = json.loads(response.read().decode("utf-8"))
                return {
                    "success": True,
                    "message_id": result.get("message_id", str(uuid.uuid4()))
                }
        except Exception as e:
            return {"success": False, "error": str(e)}
```

### 4.3 Integration with WhatsApp Inbound

```python
# Update whatsapp_inbound endpoint in main.py

def whatsapp_inbound(request: Request, ...):
    # ... existing code ...
    
    with engine.begin() as conn:
        # ... existing code ...
        
        # Check for auto-reply for unknown leads
        if phone_profile["classification"] == "unknown":
            # Check if we should auto-reply
            auto_reply_service = AutoReplyService(engine)
            should_reply, reply_reason = auto_reply_service.should_auto_reply(payload.phone)
            
            if should_reply:
                # Queue auto-reply with delay
                from worker import send_scheduled_whatsapp
                delay_seconds = int(get_db_settings().get("auto_reply_unknown_delay_seconds", 5))
                
                # Create pending reminder as auto-reply
                reminder_id = str(uuid.uuid4())
                ts = datetime.now(timezone.utc).isoformat()
                scheduled = (datetime.now(timezone.utc) + timedelta(seconds=delay_seconds)).isoformat()
                
                conn.execute(text("""
                    INSERT INTO reminders 
                    (id, entity_id, reminder_type, scheduled_for, status, created_at)
                    VALUES (:id, NULL, 'auto_reply', :sched, 'pending', :created)
                """), {
                    "id": reminder_id,
                    "sched": scheduled,
                    "created": ts
                })
                
                # The worker will pick this up and send it
                write_audit(conn, "auto_reply_queued", "reminders", reminder_id, {"phone": payload.phone})
```

---

## Phase 5: Document Templates

### 5.1 Template Variable Resolution

```python
# apps/api/services/document_generator.py
import json
import re
from datetime import datetime, timezone
from typing import Any
from pathlib import Path
from sqlalchemy import text
from sqlalchemy.engine importGenerator:
    """Service for generating documents Engine

class Document from templates."""
    
    VARIABLE_PATTERN = re.compile(r'\{\{(\w+)\}\}')
    
    def __init__(self, engine: Engine):
        self.engine = engine
    
    def resolve_variables(
        self, 
        template_content: str, 
        entity_id: str | None = None,
        event_id: str | None = None,
        context: dict | None = None
    ) -> str:
        """Resolve all variables in template content."""
        variables = self.VARIABLE_PATTERN.findall(template_content)
        
        resolved_values = {}
        for var in variables:
            resolved_values[var] = self._resolve_single_variable(
                var, entity_id, event_id, context
            )
        
        # Replace all variables
        result = template_content
        for var, value in resolved_values.items():
            result = result.replace(f"{{{{{var}}}}}", str(value))
        
        return result
    
    def _resolve_single_variable(
        self,
        var: str,
        entity_id: str | None,
        event_id: str | None,
        context: dict | None
    ) -> str:
        """Resolve a single variable."""
        # Check context first
        if context and var in context:
            return str(context[var])
        
        # Entity variables
        entity_vars = [
            "name", "full_name", "phone", "contact_phone", 
            "email", "type", "lead_score", "tags", "ai_insights"
        ]
        
        if var in entity_vars and entity_id:
            with self.engine.begin() as conn:
                row = conn.execute(text(f"SELECT {var} FROM entities WHERE id = :id"), {"id": entity_id}).fetchone()
                if row and row[0] is not None:
                    value = row[0]
                    if var == "tags" or var == "ai_insights":
                        try:
                            return json.dumps(json.loads(value) if isinstance(value, str) else value)
                        except:
                            return str(value)
                    return str(value)
        
        # Event variables
        event_vars = ["status", "scheduled_for", "event_id"]
        
        if var in event_vars and event_id:
            with self.engine.begin() as conn:
                row = conn.execute(text(f"SELECT {var} FROM events WHERE id = :id"), {"id": event_id}).fetchone()
                if row and row[0] is not None:
                    value = row[0]
                    if var == "scheduled_for" and value:
                        try:
                            dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
                            return dt.strftime("%d/%m/%Y às %H:%M")
                        except:
                            return str(value)
                    return str(value)
        
        # Computed variables
        if var == "current_date":
            return datetime.now(timezone.utc).strftime("%d/%m/%Y")
        
        if var == "current_datetime":
            return datetime.now(timezone.utc).strftime("%d/%m/%Y às %H:%M")
        
        if var == "clinic_name" and context and "clinic_name" in context:
            return context["clinic_name"]
        
        if var == "clinic_phone" and context and "clinic_phone" in context:
            return context["clinic_phone"]
        
        return f"[{var}]"
    
    def generate_document(
        self,
        template_id: str,
        entity_id: str | None = None,
        event_id: str | None = None,
        context: dict | None = None,
        output_format: str = "pdf"
    ) -> dict:
        """Generate a document from a template."""
        with self.engine.begin() as conn:
            row = conn.execute(text("""
                SELECT name, kind, title_template, body_template 
                FROM document_templates 
                WHERE id = :id AND is_active = true
            """), {"id": template_id}).fetchone()
        
        if not row:
            raise ValueError(f"Template not found: {template_id}")
        
        title_template = row[2]
        body_template = row[3]
        
        # Resolve variables
        resolved_title = self.resolve_variables(title_template, entity_id, event_id, context)
        resolved_body = self.resolve_variables(body_template, entity_id, event_id, context)
        
        if output_format == "pdf":
            return self._generate_pdf(template_id, resolved_title, resolved_body, row[1])
        elif output_format == "text":
            return {
                "title": resolved_title,
                "body": resolved_body,
                "format": "text"
            }
        else:
            raise ValueError(f"Unsupported format: {output_format}")
    
    def _generate_pdf(self, template_id: str, title: str, body: str, kind: str) -> dict:
        """Generate PDF using ReportLab."""
        import uuid
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfgen import canvas
        import hashlib
        
        # Create output directory
        base = Path(__file__).resolve().parent.parent / "generated-docs"
        base.mkdir(parents=True, exist_ok=True)
        
        doc_id = str(uuid.uuid4())
        filename = f"{kind}_{doc_id}.pdf"
        out_path = base / filename
        
        # Generate PDF
        c = canvas.Canvas(str(out_path), pagesize=A4)
        
        # Title
        c.setFont("Helvetica-Bold", 16)
        c.drawString(40, 800, title)
        
        # Body
        y = 760
        c.setFont("Helvetica", 11)
        
        for line in body.split("\n"):
            # Wrap long lines
            if len(line) > 100:
                words = line.split()
                current_line = ""
                for word in words:
                    if len(current_line + " " + word) < 100:
                        current_line += " " + word if current_line else word
                    else:
                        c.drawString(40, y, current_line)
                        y -= 15
                        current_line = word
                if current_line:
                    c.drawString(40, y, current_line)
                    y -= 15
            else:
                c.drawString(40, y, line)
                y -= 15
            
            if y < 60:
                c.showPage()
                c.setFont("Helvetica", 11)
                y = 800
        
        c.save()
        
        # Calculate checksum
        checksum = hashlib.sha256(out_path.read_bytes()).hexdigest()
        
        # Save to database
        ts = datetime.now(timezone.utc).isoformat()
        
        with self.engine.begin() as conn:
            conn.execute(text("""
                INSERT INTO document_jobs 
                (id, kind, status, output_path, checksum, payload, created_at)
                VALUES (:id, :kind, 'generated', :path, :checksum, :payload, :created)
            """), {
                "id": doc_id,
                "kind": kind,
                "path": str(out_path),
                "checksum": checksum,
                "payload": json.dumps({"template_id": template_id}),
                "created": ts
            })
        
        return {
            "document_id": doc_id,
            "path": str(out_path),
            "checksum": checksum
        }
```

---

## Phase 6: Multi-Clinic Support

### 6.1 Clinics and Users Tables

```sql
-- Additional migrations for multi-clinic
ALTER TABLE entities ADD COLUMN IF NOT EXISTS clinic_id TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS clinic_id TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS clinic_id TEXT;

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    email TEXT,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'operator',
    clinic_id TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_clinic ON users(clinic_id);
CREATE INDEX IF NOT EXISTS idx_entities_clinic ON entities(clinic_id);
CREATE INDEX IF NOT EXISTS idx_events_clinic ON events(clinic_id);
```

### 6.2 JWT Changes for Clinic ID

```python
# Update JWT token generation in main.py

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    """Create JWT access token with clinic_id."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(hours=8)
    
    to_encode.update({"exp": expire, "clinic_id": data.get("clinic_id")})
    encoded_jwt = jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.jwt_algo)
    return encoded_jwt


@app.post("/auth/token")
def auth_token(request: Request):
    """Authenticate user and return JWT token."""
    body = await request.json()
    username = body.get("username")
    password = body.get("password")
    
    if not username or not password:
        raise HTTPException(status_code=400, detail="missing_credentials")
    
    with engine.begin() as conn:
        row = conn.execute(text("""
            SELECT id, username, password_hash, role, clinic_id 
            FROM users WHERE username = :username AND is_active = true
        """), {"username": username}).fetchone()
    
    if not row:
        raise HTTPException(status_code=401, detail="invalid_credentials")
    
    # Verify password (use proper hashing in production)
    if not verify_password(password, row[2]):
        raise HTTPException(status_code=401, detail="invalid_credentials")
    
    # Create token
    token_data = {
        "sub": row[0],
        "username": row[1],
        "role": row[3],
        "clinic_id": row[4]
    }
    token = create_access_token(token_data)
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": row[0],
            "username": row[1],
            "role": row[3],
            "clinic_id": row[4]
        }
    }
```

### 6.3 Query Filtering by Clinic

```python
# Add clinic filtering helper
def get_clinic_filter(claims: dict) -> tuple[str, dict]:
    """Get SQL filter clause for clinic-based access."""
    clinic_id = claims.get("clinic_id")
    role = claims.get("role", "")
    
    # Admin/owner can see all
    if role in {"owner", "admin"}:
        return "", {}
    
    # Other roles filtered by clinic
    if clinic_id:
        return "AND clinic_id = :clinic_id", {"clinic_id": clinic_id}
    
    # No clinic assigned - return empty results
    return "AND 1=0", {}


# Example usage in endpoint
@app.get("/entities/list")
def entities_list(
    q: str | None = None,
    classification: str | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    _claims: dict = Depends(require_roles({"owner", "operator", "viewer"})),
):
    clinic_filter, clinic_params = get_clinic_filter(_claims)
    
    sql = f"""
        SELECT e.id, e.type, e.full_name, e.contact_phone, e.updated_at, e.clinic_id,
               COALESCE(p.classification, 'unknown') AS classification
        FROM entities e
        LEFT JOIN phone_identity p ON (p.phone = e.contact_phone OR p.phone = REPLACE(e.contact_phone,'+',''))
        WHERE 1=1
        {clinic_filter}
    """
    params = {**clinic_params, "limit": limit}
    
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
```

---

## Phase 7: Lead Scoring v2

### 7.1 Algorithm Implementation

```python
# apps/api/services/lead_scorer.py
import json
from datetime import datetime, timezone, timedelta
from typing import Any
from sqlalchemy import text
from sqlalchemy.engine import Engine

class LeadScorer:
    """
    Lead Scoring Algorithm v2.
    
    Score calculation factors:
    - Engagement (0-40 points): message response time, message frequency
    - Transaction History (0-30 points): completed payments, transaction count
    - Negative Factors (0-30 points deductions): no-shows, cancellations
    
    Final score: 0-100
    """
    
    ENGAGEMENT_WEIGHT = 0.40
    TRANSACTION_WEIGHT = 0.30
    NEGATIVE_WEIGHT = 0.30
    
    def __init__(self, engine: Engine):
        self.engine = engine
    
    def calculate_score(self, entity_id: str) -> dict:
        """Calculate lead score for an entity."""
        with self.engine.begin() as conn:
            # Get entity info
            entity = conn.execute(text("""
                SELECT id, type, full_name, contact_phone, lead_score, tags
                FROM entities WHERE id = :id
            """), {"id": entity_id}).fetchone()
            
            if not entity:
                return {"error": "entity_not_found"}
            
            # Calculate component scores
            engagement_score = self._calculate_engagement(entity_id)
            transaction_score = self._calculate_transactions(entity_id)
            negative_score = self._calculate_negative_factors(entity_id)
            
            # Weighted total
            total = (
                engagement_score * self.ENGAGEMENT_WEIGHT +
                transaction_score * self.TRANSACTION_WEIGHT +
                (100 - negative_score) * self.NEGATIVE_WEIGHT
            )
            
            final_score = max(0, min(100, int(total)))
            
            # Determine label
            if final_score >= 80:
                label = "Quente"
            elif final_score >= 40:
                label = "Morno"
            else:
                label = "Frio"
            
            # Update entity
            ts = datetime.now(timezone.utc).isoformat()
            conn.execute(text("""
                UPDATE entities SET lead_score = :score, updated_at = :updated WHERE id = :id
            """), {"score": final_score, "updated": ts, "id": entity_id})
            
            return {
                "entity_id": entity_id,
                "score": final_score,
                "label": label,
                "breakdown": {
                    "engagement": engagement_score,
                    "transactions": transaction_score,
                    "negative_factors": negative_score
                }
            }
    
    def _calculate_engagement(self, entity_id: str) -> float:
        """Calculate engagement score based on messaging activity."""
        with self.engine.begin() as conn:
            # Get recent messages
            thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
            
            row = conn.execute(text("""
                SELECT COUNT(*) FROM inbound_messages 
                WHERE phone IN (
                    SELECT contact_phone FROM entities WHERE id = :id
                ) AND received_at >= :since
            """), {"id": entity_id, "since": thirty_days_ago}).fetchone()
            
            message_count = row[0] if row else 0
            
            # Get entity type bonus
            type_row = conn.execute(text("""
                SELECT type FROM entities WHERE id = :id
            """), {"id": entity_id}).fetchone()
            
            type_bonus = 20 if type_row and type_row[0] == "patient" else 0
            
            # Score: 0-40 points
            # Base: 10 points
            # +2 points per message (max 20)
            # +20 for patient type
            base = 10
            message_bonus = min(20, message_count * 2)
            
            return min(40, base + message_bonus + type_bonus)
    
    def _calculate_transactions(self, entity_id: str) -> float:
        """Calculate score based on transaction history."""
        with self.engine.begin() as conn:
            # Get transactions
            row = conn.execute(text("""
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                    SUM(CASE WHEN type = 'income' THEN CAST(amount AS REAL) ELSE 0 END) as total_income
                FROM transactions 
                WHERE event_id IN (SELECT id FROM events WHERE entity_id = :id)
            """), {"id": entity_id}).fetchone()
            
            if not row or row[0] == 0:
                return 0
            
            total_count = row[0]
            paid_count = row[1] or 0
            pending_count = row[2] or 0
            total_income = row[3] or 0
            
            # Score: 0-30 points
            # Payment completion rate: 15 points max
            completion_rate = paid_count / total_count if total_count > 0 else 0
            payment_score = completion_rate * 15
            
            # Transaction count: 10 points max
            count_score = min(10, total_count * 2)
            
            # Revenue: 5 points max
            revenue_score = min(5, int(total_income / 100))
            
            return payment_score + count_score + revenue_score
    
    def _calculate_negative_factors(self, entity_id: str) -> float:
        """Calculate deductions for negative behaviors."""
        with self.engine.begin() as conn:
            # Get events for this entity
            row = conn.execute(text("""
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'noshow' THEN 1 ELSE 0 END) as noshows,
                    SUM(CASE WHEN status = 'canceled' THEN 1 ELSE 0 END) as canceled,
                    SUM(CASE WHEN status = 'reschedule_requested' THEN 1 ELSE 0 END) as rescheduled
                FROM events 
                WHERE entity_id = :id
            """), {"id": entity_id}).fetchone()
            
            if not row or row[0] == 0:
                return 0
            
            total_count = row[0]
            noshow_count = row[1] or 0
            canceled_count = row[2] or 0
            rescheduled_count = row[3] or 0
            
            # Deductions: 0-30 points
            # No-show: -10 points each
            # Canceled: -5 points each
            # Rescheduled: -2 points each
            
            noshow_deduction = min(15, noshow_count * 10)
            cancel_deduction = min(10, canceled_count * 5)
            reschedule_deduction = min(5, rescheduled_count * 2)
            
            return min(30, noshow_deduction + cancel_deduction + reschedule_deduction)
    
    def batch_score(self, clinic_id: str | None = None) -> dict:
        """Calculate scores for all entities."""
        with self.engine.begin() as conn:
            if clinic_id:
                rows = conn.execute(text("""
                    SELECT id FROM entities WHERE clinic_id = :clinic OR clinic_id IS NULL
                """), {"clinic": clinic_id}).fetchall()
            else:
                rows = conn.execute(text("SELECT id FROM entities")).fetchall()
        
        results = []
        for row in rows:
            result = self.calculate_score(row[0])
            results.append(result)
        
        return {
            "processed": len(results),
            "average_score": sum(r.get("score", 0) for r in results) / len(results) if results else 0,
            "results": results
        }
```

### 7.2 API Endpoint

```python
# Add to main.py
@app.post("/leads/scores/batch")
def leads_scores_batch(
    clinic_id: str | None = None,
    _claims: dict = Depends(require_roles({"owner", "operator"}))
):
    """Calculate scores for all leads."""
    from services.lead_scorer import LeadScorer
    scorer = LeadScorer(engine)
    return scorer.batch_score(clinic_id)


@app.get("/leads/{entity_id}/score")
def lead_score_get(
    entity_id: str,
    _claims: dict = Depends(require_roles({"owner", "operator", "viewer"}))
):
    """Get lead score for a specific entity."""
    from services.lead_scorer import LeadScorer
    scorer = LeadScorer(engine)
    return scorer.calculate_score(entity_id)
```

---

## Implementation Timeline

| Phase | Duration | Dependencies | Priority |
|-------|----------|--------------|----------|
| Phase 1: Foundation | 2 weeks | None | P0 |
| Phase 2: Automation Engine | 3 weeks | Phase 1 | P0 |
| Phase 3: WhatsApp Reminders | 2 weeks | Phase 1, 2 | P1 |
| Phase 4: Auto-Reply | 1 week | Phase 1 | P1 |
| Phase 5: Document Templates | 2 weeks | Phase 1 | P2 |
| Phase 6: Multi-Clinic | 3 weeks | Phase 1 | P1 |
| Phase 7: Lead Scoring v2 | 1 week | Phase 1, 6 | P2 |

**Total Estimated Duration:** 14 weeks

---

## Testing Strategy

### Unit Tests
- Test each service class independently
- Mock database connections
- Use pytest with fixtures

### Integration Tests
- Test API endpoints with test database
- Test automation engine with sample rules
- Test Celery tasks with mocked Redis

### E2E Tests
- Full workflow tests using the existing test framework
- WhatsApp webhook integration tests
- Document generation end-to-end

### Test Coverage Targets
- Minimum 80% code coverage for new services
- All Pydantic models must have validation tests

---

## Rollback Plan

### Database Rollbacks
```sql
-- For each migration, create a corresponding rollback script
-- Example:
-- ROLLBACK SCRIPT: 2026_03_07_phase1_schema_extensions_rollback.sql
-- ALTER TABLE entities DROP COLUMN IF EXISTS clinic_id;
-- DROP TABLE IF EXISTS automation_rules;
-- DROP TABLE IF EXISTS reminders;
-- DROP TABLE IF EXISTS whatsapp_templates;
-- DROP TABLE IF EXISTS document_templates;
```

### Feature Flags
All new features should be controlled via feature flags in `app_settings`:

```python
FEATURE_FLAGS = {
    "automation_engine_enabled": False,
    "whatsapp_reminders_enabled": False,
    "auto_reply_unknown_enabled": False,
    "document_templates_enabled": False,
    "multi_clinic_enabled": False,
    "lead_scoring_v2_enabled": False
}
```

### Rollback Procedure
1. Set all feature flags to False
2. Run rollback SQL scripts
3. Deploy previous stable version
4. Verify system health via `/ops/gonogo/checklist`

---

## Feature Flag Implementation

```python
# apps/api/services/feature_flags.py
from sqlalchemy import text
from sqlalchemy.engine import Engine

class FeatureFlags:
    """Feature flag management."""
    
    DEFAULT_FLAGS = {
        "automation_engine_enabled": False,
        "whatsapp_reminders_enabled": False,
        "auto_reply_unknown_enabled": False,
        "document_templates_enabled": False,
        "multi_clinic_enabled": False,
        "lead_scoring_v2_enabled": False,
        "amd_gpu_detection_enabled": True
    }
    
    @staticmethod
    def is_enabled(engine: Engine, flag_name: str) -> bool:
        """Check if a feature flag is enabled."""
        if flag_name not in FeatureFlags.DEFAULT_FLAGS:
            return False
        
        with engine.begin() as conn:
            row = conn.execute(text("""
                SELECT value FROM app_settings WHERE key = :key
            """), {"key": f"feature_{flag_name}"}).fetchone()
        
        if not row:
            return FeatureFlags.DEFAULT_FLAGS.get(flag_name, False)
        
        try:
            return bool(json.loads(row[0]))
        except:
            return False
    
    @staticmethod
    def set_enabled(engine: Engine, flag_name: str, enabled: bool):
        """Set a feature flag."""
        with engine.begin() as conn:
            conn.execute(text("""
                INSERT INTO app_settings (key, value, updated_at)
                VALUES (:key, :value, :updated)
                ON CONFLICT(key) DO UPDATE SET value = :value, updated_at = :updated
            """), {
                "key": f"feature_{flag_name}",
                "value": json.dumps(enabled),
                "updated": datetime.now(timezone.utc).isoformat()
            })
    
    @staticmethod
    def get_all(engine: Engine) -> dict:
        """Get all feature flags with their status."""
        flags = FeatureFlags.DEFAULT_FLAGS.copy()
        
        with engine.begin() as conn:
            rows = conn.execute(text("""
                SELECT key, value FROM app_settings WHERE key LIKE 'feature_%'
            """)).fetchall()
        
        for row in rows:
            flag_name = row[0].replace("feature_", "")
            try:
                flags[flag_name] = json.loads(row[1])
            except:
                pass
        
        return flags
```

---

## Summary

This implementation plan provides a comprehensive roadmap for extending the L2 CORE OS platform with:

1. **Improved hardware detection** for AMD GPUs
2. **Extended database schema** for automation, reminders, and templates
3. **Full automation engine** with triggers, conditions, and actions
4. **WhatsApp reminder system** with Celery beat scheduling
5. **Auto-reply service** for unknown leads
6. **Document template system** with variable resolution and PDF generation
7. **Multi-clinic support** with JWT-based access control
8. **Enhanced lead scoring algorithm** with engagement, transaction, and negative factor analysis

Each phase includes specific code examples, SQL migrations, Pydantic models, and testing strategies to ensure successful implementation.
