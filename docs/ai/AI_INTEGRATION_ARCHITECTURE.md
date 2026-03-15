# AI Integration Architecture - Anti-Fragile System

## Overview
Idempotent, queued AI system that works reliably on any machine with minimum specs (8GB RAM).

## Core Principles

### 1. Idempotency (Never Duplicate)
- Every message has a unique `intent_id` based on message_id + timestamp
- Redis SETNX to claim processing lock
- If lock exists, skip processing (already in queue or processed)
- **Exactly one** AI classification per message, guaranteed

### 2. Queue System (No Bottlenecks)
- Celery with Redis broker
- Priority queue: emergency > high > normal > low
- Max 1 concurrent task per worker (avoid memory issues on CPU)
- Automatic retry with exponential backoff
- Dead letter queue for failed items

### 3. Fallback Chain (Works Everywhere)
```
Try Ollama (local) → 
  If fails: Try deterministic (rule-based) → 
    If fails: Queue for later retry
```

### 4. Real-Time Updates (No Refresh)
- Server-Sent Events (SSE) for dashboard updates
- Progress: queued → processing → completed/failed
- Live AI status indicator

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  WhatsApp   │────▶│   API       │────▶│   Redis     │
│  Webhook    │     │  (validate) │     │  (queue)    │
└─────────────┘     └──────┬──────┘     └──────┬──────┘
                           │                    │
                           ▼                    ▼
                    ┌─────────────┐     ┌─────────────┐
                    │  Idempotent │     │   Celery    │
                    │   Check     │     │   Worker    │
                    └──────┬──────┘     └──────┬──────┘
                           │                    │
                           ▼                    ▼
                    ┌─────────────┐     ┌─────────────┐
                    │  Already     │     │  Process    │
                    │  Processed? │     │  (Ollama)   │
                    └─────────────┘     └──────┬──────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │   Result    │
                                        │  stored    │
                                        └──────┬──────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │    SSE      │
                                        │  Broadcast  │
                                        └─────────────┘
```

## Database Schema

```sql
-- AI Queue for tracking
CREATE TABLE IF NOT EXISTS ai_intent_queue (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL,
    phone TEXT NOT NULL,
    message_text TEXT,
    status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
    intent TEXT,
    urgency INTEGER,
    sentiment TEXT,
    summary TEXT,
    confidence REAL,
    model_used TEXT, -- 'ollama' or 'deterministic'
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX idx_ai_queue_status ON ai_intent_queue(status);
CREATE INDEX idx_ai_queue_message ON ai_intent_queue(message_id);
```

## API Endpoints

### POST /ai/classify (trigger classification)
- Input: { message_id, phone, text }
- Returns: { queue_id, status: "queued" | "processing" | "completed" }
- Idempotent: same message_id returns existing result

### GET /ai/queue/{queue_id} (check status)
- Returns: { status, intent, urgency, sentiment, summary, confidence }

### GET /ai/stream (SSE for real-time updates)
- Opens server-sent events connection
- Broadcasts: status changes, new classifications

### GET /ai/status
- Returns: { ollama_running: bool, cpu_available: bool, queue_length: int }

## Celery Tasks

### classify_message_task
```python
@celery_app.task(bind=True, max_retries=3, acks_late=True)
def classify_message_task(self, queue_id: str):
    # 1. Check idempotency lock
    # 2. Set status = processing
    # 3. Try Ollama first
    # 4. Fallback to deterministic
    # 5. Store result
    # 6. Release lock
    # 7. Broadcast via SSE
```

### check_pending_classifications (runs every 30s)
- Queries pending items
- Dispatches to workers

## Fallback Deterministic Classification

If Ollama fails:
```python
def deterministic_classify(text: str) -> dict:
    text_lower = text.lower()
    
    # Emergency
    if any(w in text_lower for w in ['urgente', 'emergência', 'dor forte', 'sangrando']):
        return {intent: 'emergency', urgency: 5, sentiment: 'negative', confidence: 0.9}
    
    # Appointment confirm
    if any(w in text_lower for w in ['confirmo', 'ok', 'certeza', 'podevi']):
        return {intent: 'confirm', urgency: 1, sentiment: 'positive', confidence: 0.85}
    
    # Cancel
    if any(w in text_lower for w in ['cancelo', 'não posso', 'impossível']):
        return {intent: 'cancel', urgency: 2, sentiment: 'negative', confidence: 0.8}
    
    # Default
    return {intent: 'general', urgency: 3, sentiment: 'neutral', confidence: 0.5}
```

## Frontend Integration

### Dashboard AI Panel
- Status: "IA Ativa" (green) / "IA Simbólica" (yellow) / "IA Offline" (red)
- Queue count display
- Real-time progress bar
- Recent classifications list

### SSE Connection
```typescript
const eventSource = new EventSource('/ai/stream');
eventSource.onmessage = (e) => {
  const data = JSON.parse(e.data);
  updateAIStatus(data);
};
```

## Minimum Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| RAM | 8 GB | 16 GB |
| CPU | 4 cores | 8 cores |
| Disk | 5 GB | 20 GB |
| Ollama | 3B model | 3B model |

## Error Handling

1. **Ollama not running**: Fallback to deterministic immediately
2. **Timeout**: Retry up to 3 times, then mark failed
3. **Memory pressure**: Reduce batch size, process one at a time
4. **Queue overflow**: Reject new requests with 429, process existing first
