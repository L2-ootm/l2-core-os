# SECURITY BASELINE

## 1) RBAC Minimalista
- `owner`: acesso total
- `operator`: operação diária
- `viewer`: leitura

## 2) Rate Limiting
- IP: 60 req/min
- Token autenticado: 120 req/min
- Webhooks críticos: limite dedicado + burst control

## 3) Banco de Dados
- Usuário app sem privilégio de superuser
- Migrações versionadas
- Backup diário + retenção mínima
- Criptografia em repouso (quando cloud) e em trânsito (TLS)

## 4) Webhook Protection
- Assinatura HMAC obrigatória
- Janela de replay curta
- Reject por payload inválido

## 5) Auditoria
- Toda mutação em Entities/Events/Transactions gera log
- Tabela de auditoria imutável no app layer
