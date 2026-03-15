from celery import Celery
from datetime import datetime, timezone
import json

celery_app = Celery('ai_classifier')
celery_app.config_from_object('core.config')

@celery_app.task(bind=True, max_retries=3, acks_late=True)
def classify_message_task(self, queue_id: str, message_id: str, phone: str, text: str):
    """
    Process AI classification for a message.
    - Idempotent: uses message_id as key
    - Fallback: Ollama -> Deterministic
    - Real-time: broadcasts status via Redis pub/sub
    """
    from sqlalchemy import create_engine
    from sqlalchemy.sql import text
    from core.config import settings
    from services.ai_queue import DeterministicClassifier
    
    engine = create_engine(settings.database_url, future=True)
    now = datetime.now(timezone.utc).isoformat()
    
    def update_status(status: str, **kwargs):
        sets = ["status = :status", "updated_at = :updated"]
        params = {"status": status, "updated": now, "id": queue_id}
        
        for key, value in kwargs.items():
            sets.append(f"{key} = :{key}")
            params[key] = value
        
        query = f"UPDATE ai_intent_queue SET {', '.join(sets)} WHERE id = :id"
        with engine.begin() as conn:
            conn.execute(text(query), params)
        
        try:
            import redis
            r = redis.from_url(settings.redis_url)
            broadcast = {
                "queue_id": queue_id,
                "message_id": message_id,
                "status": status,
                **kwargs
            }
            r.publish("ai_updates", json.dumps(broadcast))
        except:
            pass
    
    try:
        update_status("processing")
        
        model_used = None
        result = None
        
        try:
            from services.ollama_client import OllamaClient
            ollama = OllamaClient()
            
            if await ollama.is_running():
                result = await ollama.classify_intent(text)
                model_used = "ollama"
        except Exception as e:
            print(f"Ollama failed, using deterministic: {e}")
        
        if not result:
            result = DeterministicClassifier.classify(text)
            model_used = "deterministic"
        
        update_status(
            "completed",
            intent=result.get("intent", "general"),
            urgency=result.get("urgency", 3),
            sentiment=result.get("sentiment", "neutral"),
            summary=result.get("summary", ""),
            confidence=result.get("confidence", 0.5),
            model_used=model_used
        )
        
        try:
            import redis
            r = redis.from_url(settings.redis_url)
            r.delete(f"lock:intent_{message_id}")
        except:
            pass
        
        return {"status": "completed", "result": result}
    
    except Exception as e:
        retry = self.request.retries
        
        if retry >= self.max_retries:
            update_status("failed", error_message=str(e), retry_count=retry)
            
            try:
                result = DeterministicClassifier.classify(text)
                update_status(
                    "completed",
                    intent=result.get("intent", "general"),
                    urgency=result.get("urgency", 3),
                    sentiment=result.get("sentiment", "neutral"),
                    summary=result.get("summary", ""),
                    confidence=result.get("confidence", 0.5),
                    model_used="deterministic_fallback",
                    error_message=None
                )
            except:
                pass
            
            return {"status": "failed", "error": str(e)}
        else:
            update_status("pending", retry_count=retry + 1)
            raise self.retry(exc=e, countdown=60 * (2 ** retry))


@celery_app.task
def process_ai_queue():
    """
    Periodic task to check and process pending classifications.
    Runs every 30 seconds.
    """
    from sqlalchemy import create_engine
    from sqlalchemy.sql import text
    from core.config import settings
    
    engine = create_engine(settings.database_url, future=True)
    
    with engine.begin() as conn:
        rows = conn.execute(text("""
            SELECT id, message_id, phone, message_text 
            FROM ai_intent_queue 
            WHERE status = 'pending' 
            ORDER BY created_at ASC 
            LIMIT 10
        """)).fetchall()
    
    for row in rows:
        classify_message_task.delay(row.id, row.message_id, row.phone, row.message_text)
    
    return {"dispatched": len(rows)}


celery_app.conf.beat_schedule = {
    "process-ai-queue-every-30s": {
        "task": "tasks.ai_classifier.process_ai_queue",
        "schedule": 30.0,
    },
}
