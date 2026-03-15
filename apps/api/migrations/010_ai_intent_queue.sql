-- AI Intent Queue Migration
-- 010_ai_intent_queue.sql

-- Create ai_intent_queue table
CREATE TABLE IF NOT EXISTS ai_intent_queue (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL,
    phone TEXT NOT NULL,
    message_text TEXT,
    status TEXT DEFAULT 'pending',
    intent TEXT,
    urgency INTEGER,
    sentiment TEXT,
    summary TEXT,
    confidence REAL,
    model_used TEXT,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_ai_intent_queue_message_id ON ai_intent_queue(message_id);
CREATE INDEX IF NOT EXISTS idx_ai_intent_queue_status ON ai_intent_queue(status);
