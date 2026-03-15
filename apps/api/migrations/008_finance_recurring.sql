-- Migration 008: Add recurring transactions support
-- Creates recurring_transactions table

CREATE TABLE IF NOT EXISTS recurring_transactions (
    id TEXT PRIMARY KEY,
    entity_id TEXT,
    amount DECIMAL(10,2),
    type TEXT,
    category TEXT,
    frequency TEXT,
    start_date TEXT,
    end_date TEXT,
    last_created_at TEXT,
    status TEXT DEFAULT 'active',
    created_at TEXT,
    updated_at TEXT
);

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS recurring_id TEXT;
