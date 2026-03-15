---
name: real-time-systems
description: "Use this skill when building real-time features - implementing WebSockets, server-sent events, polling strategies, live updates, or notification systems."
---

# Real-Time Systems Patterns

## When to use this skill
- When building live chat or messaging
- When implementing real-time notifications
- When building collaborative features
- When designing event-driven updates

## Communication Patterns

### WebSockets
```javascript
// Client
const ws = new WebSocket('ws://api.example.com/ws');

ws.onopen = () => console.log('Connected');
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  handleMessage(data);
};

ws.send(JSON.stringify({ type: 'message', content: 'Hello' }));
```

### Server-Sent Events (SSE)
```javascript
// Client
const eventSource = new EventSource('/api/events');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  updateUI(data);
};

// Server (FastAPI)
from fastapi.responses import StreamingResponse

@app.get("/api/events")
def events():
    def generate():
        while True:
            yield f"data: {json.dumps(get_message())}\n\n"
    return StreamingResponse(generate(), media_type="text/event-stream")
```

### Polling
```typescript
// Simple polling
useEffect(() => {
  const interval = setInterval(fetchData, 5000);
  return () => clearInterval(interval);
}, []);

// With React Query
const { data } = useQuery({
  queryKey: ['messages'],
  queryFn: fetchMessages,
  refetchInterval: 5000,
});
```

## When to Use What

| Scenario | Solution |
|----------|----------|
| Chat/Messaging | WebSockets |
| Live notifications | WebSockets or SSE |
| Dashboard updates | Polling or SSE |
| Real-time collab | WebSockets |
| Server->Client only | SSE |

## WebSocket Server (FastAPI)

```python
from fastapi import WebSocket

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            # Process and broadcast
            await websocket.send_json({"response": "processed"})
    except Exception:
        # Handle disconnect
        pass
```

## Message Patterns

### Pub/Sub
```python
# Redis pub/sub
import redis

r = redis.Redis()
p = r.pubsub()

# Subscribe
p.subscribe('notifications')

# Listen
for message in p.listen():
    if message['type'] == 'message':
        notify_user(message['data'])

# Publish
r.publish('notifications', json.dumps({'user': 'john', 'msg': 'Hello'}))
```

### Broadcast
```python
# Store active connections
connections = {}

async def connect(websocket):
    await websocket.accept()
    connections[user_id] = websocket

async def broadcast(message):
    for ws in connections.values():
        await ws.send_json(message)
```

## Connection Management

### Heartbeat
```javascript
// Client - send ping every 30s
setInterval(() => {
  ws.send(JSON.stringify({ type: 'ping' }));
}, 30000);

// Server - expect pong within 10s
```

### Reconnection
```javascript
// Auto-reconnect with backoff
function connect() {
  ws = new WebSocket(url);
  
  ws.onclose = () => {
    const delay = Math.min(1000 * Math.pow(2, attempts), 30000);
    setTimeout(connect, delay);
    attempts++;
  };
}
```

## Scaling

### Redis Adapter (for multiple workers)
```python
from fastapi import FastAPI
from fastapi_parallel import ParallelAPIRouter

# Use Redis to coordinate across workers
```

### Horizontal Scaling
- Use Redis pub/sub for cross-instance communication
- Use sticky sessions for WebSockets
- Consider managed services (Pusher, Ably)

## Best Practices

1. **Always handle disconnect/reconnect**
2. **Use heartbeats to detect dead connections**
3. **Implement message queuing for offline users**
4. **Validate and sanitize all messages**
5. **Use JSON for serialization**
6. **Implement rate limiting**
7. **Log connection events**

## Error Handling

```javascript
ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = (event) => {
  if (!event.wasClean) {
    // Unexpected disconnect - reconnect
    reconnect();
  }
};
```

## Performance Tips

1. Compress messages if large
2. Batch updates when possible
3. Use binary protocol for high volume
4. Implement message acknowledgment
5. Monitor connection count per worker
