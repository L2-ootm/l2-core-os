CREATE TABLE IF NOT EXISTS whatsapp_templates (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    body TEXT NOT NULL,
    variables TEXT[],
    language TEXT DEFAULT 'pt_BR',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Insert default templates
INSERT INTO whatsapp_templates (id, name, body, variables, language, created_at, updated_at) VALUES
    ('tpl_reminder_24h', 'reminder_24h', 'Olá {name}! Amanhã você tem agendamento às {time}. Confirme ou cancele.', ARRAY['name', 'time'], 'pt_BR', datetime('now'), datetime('now')),
    ('tpl_reminder_2h', 'reminder_2h', 'Olá {name}! Sua consulta é em 2 horas. Estamos te esperando!', ARRAY['name'], 'pt_BR', datetime('now'), datetime('now')),
    ('tpl_confirmed', 'appointment_confirmed', 'Sua consulta foi confirmada para {date} às {time}. Até logo!', ARRAY['date', 'time'], 'pt_BR', datetime('now'), datetime('now')),
    ('tpl_canceled', 'appointment_canceled', 'Sua consulta foi cancelada. Para remarcar, responda esta mensagem.', ARRAY[], 'pt_BR', datetime('now'), datetime('now')),
    ('tpl_noshow', 'no_show_followup', 'Olá {name}! Não percebemos você hoje. Gostaria de remarcar?', ARRAY['name'], 'pt_BR', datetime('now'), datetime('now')),
    ('tpl_auto_reply', 'auto_reply_unknown', 'Olá! Obrigado por entrar em contato. Em breve nossa equipe retornará.', ARRAY[], 'pt_BR', datetime('now'), datetime('now'))
ON CONFLICT (name) DO NOTHING;
