CREATE TABLE IF NOT EXISTS document_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    body TEXT NOT NULL,
    variables TEXT DEFAULT '[]',
    is_default BOOLEAN DEFAULT false,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Insert default templates
INSERT INTO document_templates (id, name, kind, body, is_default, created_at, updated_at) VALUES
    ('doc_contract', 'Termo de Consentimento', 'contract', 
     '# TERMO DE CONSENTIMENTO\n\nPaciente: {entity_full_name}\nTelefone: {entity_contact_phone}\nData: {event_scheduled_for}\n\nDeclaro que fui informado(a) sobre o procedimento...',
     true, datetime('now'), datetime('now')),
    ('doc_receipt', 'Recibo', 'receipt',
     '# RECIBO\n\nRecebemos de {entity_full_name}\nValor: R$ {transaction_amount}\nCategoria: {transaction_category}\nData: {transaction_date}',
     true, datetime('now'), datetime('now'))
ON CONFLICT (id) DO NOTHING;
