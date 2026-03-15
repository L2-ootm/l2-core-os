import uuid
import json
import asyncio
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import create_engine
from sqlalchemy.sql import text
import httpx

class AIQueueService:
    """
    Anti-fragile AI classification system with:
    - Idempotency (never process same message twice)
    - Queue-based processing
    - Fallback to deterministic classification
    - Real-time status updates via SSE
    """
    
    def __init__(self):
        from core.config import settings
        self.engine = create_engine(settings.database_url, future=True)
        self.redis_client = None
        try:
            import redis
            self.redis_client = redis.from_url(settings.redis_url)
        except:
            pass
    
    def _get_redis(self):
        """Get Redis client, creating if needed"""
        if not self.redis_client:
            from core.config import settings
            import redis
            self.redis_client = redis.from_url(settings.redis_url)
        return self.redis_client
    
    async def classify_message(self, message_id: str, phone: str, text: str) -> dict:
        """
        Queue a message for AI classification.
        Idempotent - returns existing result if already processed.
        """
        intent_id = f"intent_{message_id}"
        
        existing = await self._get_existing_result(intent_id)
        if existing:
            return {
                "id": intent_id,
                "status": existing["status"],
                "result": existing,
                "idempotent": True
            }
        
        lock_key = f"lock:{intent_id}"
        redis = self._get_redis()
        
        if redis:
            acquired = redis.setnx(lock_key, "processing")
            if not acquired:
                return {
                    "id": intent_id,
                    "status": "processing",
                    "idempotent": False
                }
            redis.expire(lock_key, 300)
        
        queue_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        
        with self.engine.begin() as conn:
            conn.execute(text("""
                INSERT INTO ai_intent_queue 
                (id, message_id, phone, message_text, status, created_at, updated_at)
                VALUES (:id, :msg_id, :phone, :text, 'pending', :created, :updated)
            """), {
                "id": queue_id,
                "msg_id": message_id,
                "phone": phone,
                "text": text,
                "created": now,
                "updated": now
            })
        
        from tasks.ai_classifier import classify_message_task
        classify_message_task.delay(queue_id, message_id, phone, text)
        
        return {
            "id": queue_id,
            "status": "queued",
            "idempotent": False
        }
    
    async def _get_existing_result(self, intent_id: str) -> Optional[dict]:
        """Check if message was already processed"""
        try:
            with self.engine.begin() as conn:
                row = conn.execute(text("""
                    SELECT * FROM ai_intent_queue 
                    WHERE id = :id AND status = 'completed'
                """), {"id": intent_id}).fetchone()
                
                if row:
                    return {
                        "intent": row.intent,
                        "urgency": row.urgency,
                        "sentiment": row.sentiment,
                        "summary": row.summary,
                        "confidence": row.confidence,
                        "model_used": row.model_used,
                        "updated_at": row.updated_at
                    }
        except:
            pass
        return None
    
    async def get_status(self, queue_id: str) -> dict:
        """Get status of a classification"""
        with self.engine.begin() as conn:
            row = conn.execute(text("""
                SELECT * FROM ai_intent_queue WHERE id = :id
            """), {"id": queue_id}).fetchone()
            
            if not row:
                return {"status": "not_found"}
            
            return {
                "id": row.id,
                "status": row.status,
                "intent": row.intent,
                "urgency": row.urgency,
                "sentiment": row.sentiment,
                "summary": row.summary,
                "confidence": row.confidence,
                "model_used": row.model_used,
                "error": row.error_message,
                "retry_count": row.retry_count
            }
    
    async def get_queue_status(self) -> dict:
        """Get overall AI queue status"""
        with self.engine.begin() as conn:
            pending = conn.execute(text(
                "SELECT COUNT(*) FROM ai_intent_queue WHERE status = 'pending'"
            )).scalar()
            
            processing = conn.execute(text(
                "SELECT COUNT(*) FROM ai_intent_queue WHERE status = 'processing'"
            )).scalar()
            
            completed = conn.execute(text(
                "SELECT COUNT(*) FROM ai_intent_queue WHERE status = 'completed'"
            )).scalar()
            
            failed = conn.execute(text(
                "SELECT COUNT(*) FROM ai_intent_queue WHERE status = 'failed'"
            )).scalar()
        
        ollama_status = await self._check_ollama()
        
        return {
            "queue": {
                "pending": pending or 0,
                "processing": processing or 0,
                "completed": completed or 0,
                "failed": failed or 0
            },
            "ollama": ollama_status,
            "mode": "active" if ollama_status["running"] else "symbolic"
        }
    
    async def _check_ollama(self) -> dict:
        """Check if Ollama is running"""
        try:
            async with httpx.AsyncClient() as client:
                r = await client.get("http://localhost:11434/api/tags", timeout=3)
                if r.status_code == 200:
                    models = r.json().get("models", [])
                    return {
                        "running": True,
                        "models": [m["name"] for m in models]
                    }
        except:
            pass
        return {"running": False, "models": []}
    
    def broadcast_update(self, queue_id: str, status: str):
        """Broadcast update via SSE (called by Celery task)"""
        pass


class DeterministicClassifier:
    """Fallback classifier when Ollama is not available"""
    
    EMERGENCY_KEYWORDS = ['urgente', 'emergência', 'dor forte', 'sangrando', 'não consigo']
    CONFIRM_KEYWORDS = ['confirmo', 'ok', 'certeza', 'pode vim', 'estou indo', 'blz']
    CANCEL_KEYWORDS = ['cancelo', 'não posso', 'impossível', 'desmarcar', 'remarcar']
    QUESTION_KEYWORDS = ['quanto', 'qual', 'como', 'onde', 'quando', 'perguntei']
    PAYMENT_KEYWORDS = ['pagou', 'transferi', 'pix', 'dinheiro', 'valor', 'recebi']
    
    @classmethod
    def classify(cls, text: str) -> dict:
        """Deterministic fallback classification"""
        text_lower = text.lower()
        
        if any(w in text_lower for w in cls.EMERGENCY_KEYWORDS):
            return {
                "intent": "emergency",
                "urgency": 5,
                "sentiment": "negative",
                "confidence": 0.9,
                "summary": "Situação de emergência relatada"
            }
        
        if any(w in text_lower for w in cls.CONFIRM_KEYWORDS):
            return {
                "intent": "confirm_appointment",
                "urgency": 1,
                "sentiment": "positive",
                "confidence": 0.85,
                "summary": "Confirmação de agendamento"
            }
        
        if any(w in text_lower for w in cls.CANCEL_KEYWORDS):
            return {
                "intent": "cancel_appointment",
                "urgency": 2,
                "sentiment": "negative",
                "confidence": 0.8,
                "summary": "Cancelamento ou remarcação solicitado"
            }
        
        if any(w in text_lower for w in cls.PAYMENT_KEYWORDS):
            return {
                "intent": "payment",
                "urgency": 2,
                "sentiment": "neutral",
                "confidence": 0.75,
                "summary": "Referência a pagamento"
            }
        
        if any(w in text_lower for w in cls.QUESTION_KEYWORDS):
            return {
                "intent": "question",
                "urgency": 3,
                "sentiment": "neutral",
                "confidence": 0.6,
                "summary": "Pergunta geral"
            }
        
        return {
            "intent": "general",
            "urgency": 3,
            "sentiment": "neutral",
            "confidence": 0.5,
            "summary": "Mensagem geral"
        }
