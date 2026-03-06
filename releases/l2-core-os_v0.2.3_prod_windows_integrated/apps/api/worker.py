from celery import Celery
import os

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
celery_app = Celery("l2core", broker=REDIS_URL, backend=REDIS_URL)

@celery_app.task(bind=True, autoretry_for=(Exception,), retry_backoff=True, max_retries=5)
def ping_task(self):
    return {"ok": True, "task": "ping_task"}
