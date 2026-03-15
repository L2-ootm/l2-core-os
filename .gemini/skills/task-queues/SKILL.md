---
name: task-queues
description: "Use this skill when implementing background jobs - setting up Celery, implementing worker tasks, scheduling periodic jobs, handling retries, or managing task queues."
---

# Task Queue Patterns

## When to use this skill
- When implementing background processing
- When setting up periodic tasks
- When handling async jobs with Celery
- When building webhook handlers

## Celery Basics

### Task Definition
```python
from celery import Celery

app = Celery('myapp', broker='redis://localhost:6379/0')

@app.task(bind=True, max_retries=3)
def my_task(self, *args, **kwargs):
    try:
        # Do work
        return result
    except Exception as e:
        # Retry with backoff
        raise self.retry(exc=e, countdown=60)
```

### Task Options
- `bind=True`: Pass self to access retry info
- `max_retries`: Maximum retry attempts
- `retry_backoff`: Exponential backoff
- `retry_backoff_max`: Max backoff time
- `autoretry_for`: Auto retry specific exceptions

## Periodic Tasks (Celery Beat)

### Schedule Definition
```python
app.conf.beat_schedule = {
    'task-every-5-minutes': {
        'task': 'tasks.my_task',
        'schedule': 300.0,  # seconds
    },
    'task-every-hour': {
        'task': 'tasks.hourly_task',
        'schedule': 3600.0,
    },
}
```

## Retry Strategies

### Exponential Backoff
```python
@app.task(bind=True, max_retries=5)
def task_with_backoff(self):
    try:
        # Work
        pass
    except Exception as e:
        # Retry: 1s, 2s, 4s, 8s, 16s
        countdown = 2 ** self.request.retries
        raise self.retry(exc=e, countdown=countdown)
```

### Fixed Retry
```python
@app.task(bind=True, max_retries=3, default_retry_delay=300)
def task_with_fixed_delay(self):
    # 5 minute delay between retries
    raise self.retry(exc=e)
```

## Idempotency

### Why It Matters
- Tasks may execute multiple times
- Network failures can cause duplicates
- Ensure same input = same result

### Implementation
```python
@app.task
def process_order(order_id):
    # Check if already processed
    if OrderProcessed.objects.filter(order_id=order_id).exists():
        return 'already_processed'
    
    # Process
    process(order_id)
    OrderProcessed.objects.create(order_id=order_id)
    return 'processed'
```

## Error Handling

### Task Error Handling
```python
@app.task
def task_with_error_handling(data):
    try:
        return process(data)
    except ValidationError as e:
        # Handle specific error
        log.error(f'Validation failed: {e}')
        return {'status': 'validation_error'}
    except Exception as e:
        # Re-raise for retry
        raise
```

### Logging
```python
import logging
logger = logging.getLogger(__name__)

@app.task
def logged_task(data):
    logger.info(f'Starting task with {data}')
    try:
        result = process(data)
        logger.info(f'Task completed: {result}')
        return result
    except Exception as e:
        logger.error(f'Task failed: {e}')
        raise
```

## Monitoring

### Task States
- PENDING: Queued
- STARTED: Worker picked up
- SUCCESS: Completed
- FAILURE: Exception raised
- RETRY: Retrying

### Best Practices
1. Use unique task IDs
2. Log all task events
3. Set reasonable timeouts
4. Monitor queue lengths
5. Set up alerts for failures

## Queue Patterns

### Task Chaining
```python
from celery import chain

# Execute tasks in sequence
chain(task_a.s(), task_b.s(), task_c.s())()

# Or with result
result = chain(add.s(2, 2), mul.s(10))()
```

### Task Group
```python
from celery import group

# Execute tasks in parallel
group(task.s(item) for item in items)()
```

## Common Use Cases

| Use Case | Pattern |
|----------|---------|
| Send email | Async task with retry |
| Process upload | Background task + status update |
| Scheduled reports | Celery Beat |
| Webhook handler | Queue task, respond immediately |
| Data sync | Periodic task with locking |
