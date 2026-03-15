ALTER TABLE entities ADD COLUMN IF NOT EXISTS clinic_id TEXT DEFAULT 'default';
ALTER TABLE entities ADD COLUMN IF NOT EXISTS lead_score INTEGER DEFAULT 50;
ALTER TABLE entities ADD COLUMN IF NOT EXISTS last_contacted_at TEXT;
ALTER TABLE entities ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
ALTER TABLE entities ADD COLUMN IF NOT EXISTS tags TEXT;

CREATE INDEX IF NOT EXISTS idx_entities_clinic ON entities(clinic_id);
CREATE INDEX IF NOT EXISTS idx_entities_lead_score ON entities(lead_score);
