CREATE TABLE IF NOT EXISTS reminders (
    id TEXT PRIMARY KEY,
    event_id TEXT,
    entity_id TEXT,
    send_at TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    message_template TEXT,
    whatsapp_sent_at TEXT,
    failure_reason TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders(status);
CREATE INDEX IF NOT EXISTS idx_reminders_send_at ON reminders(send_at);
