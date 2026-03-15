CREATE TABLE IF NOT EXISTS clinics (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    email TEXT,
    cnpj TEXT,
    settings TEXT DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Insert default clinic
INSERT INTO clinics (id, name, address, phone, email, created_at, updated_at) VALUES
    ('default', 'Clínica Principal', '', '', '', datetime('now'), datetime('now'))
ON CONFLICT (id) DO NOTHING;
