-- Outbound Messages Table
-- 011_outbound_messages.sql

CREATE TABLE IF NOT EXISTS outbound_messages (
    id TEXT PRIMARY KEY,
    phone TEXT NOT NULL,
    text TEXT,
    sent_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_outbound_messages_phone ON outbound_messages(phone);
CREATE INDEX IF NOT EXISTS idx_outbound_messages_sent_at ON outbound_messages(sent_at);
