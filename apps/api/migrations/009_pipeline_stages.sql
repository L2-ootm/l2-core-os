-- Pipeline Stages Migration
-- 009_pipeline_stages.sql

-- Add pipeline columns to entities table
ALTER TABLE entities ADD COLUMN IF NOT EXISTS pipeline_stage TEXT DEFAULT 'novo';
ALTER TABLE entities ADD COLUMN IF NOT EXISTS pipeline_value DECIMAL(10,2);
ALTER TABLE entities ADD COLUMN IF NOT EXISTS last_stage_change TEXT;

-- Create pipeline_stages table
CREATE TABLE IF NOT EXISTS pipeline_stages (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    order_index INTEGER DEFAULT 0,
    color TEXT,
    created_at TEXT
);

-- Insert default stages
INSERT INTO pipeline_stages (id, name, order_index, color, created_at) VALUES
    ('novo', 'Novo', 0, '#3b82f6', datetime('now')),
    ('qualificado', 'Qualificado', 1, '#8b5cf6', datetime('now')),
    ('agendado', 'Agendado', 2, '#f59e0b', datetime('now')),
    ('consulta', 'Em Consulta', 3, '#10b981', datetime('now')),
    ('fechado', 'Fechado', 4, '#22c55e', datetime('now')),
    ('perdido', 'Perdido', 5, '#ef4444', datetime('now'))
ON CONFLICT(id) DO NOTHING;
