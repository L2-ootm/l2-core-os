# ANTIFRAGILE + IDEMPOTENCY IMPLEMENTATION (2026-03-05)

## Entregas

### 1) Inbound antifrágil com classificação por telefone
- Nova tabela `phone_identity` para rastrear origem/classificação:
  - `known_client`, `new_lead`, `unknown`
- Regra: números desconhecidos não entram em automação cega; vão para `human_review_queue`.

### 2) Automação com segurança para clientes existentes
- Webhook inbound agora:
  - atualiza status de evento quando intenção é clara e evento existe;
  - cria `service_request` quando cliente pede novo serviço;
  - audita todas as ações em `audit_logs`.

### 3) Idempotência reforçada no gateway
- Deduplicação de inbound por `external_message_id` também no gateway (`processedInboundIds`).
- Deduplicação de outbound por `idempotency_key` (`processedOutboundKeys`).
- Processamento de tipos `notify` e `append` para reduzir perda após reconexão.

### 4) PDFs por script
- Novo endpoint: `POST /documents/generate`
- Gera PDF via `reportlab` e registra:
  - caminho do arquivo
  - checksum SHA256
  - auditoria em `document_jobs` + `audit_logs`

### 5) Observabilidade operacional
- Novo endpoint: `GET /ops/inbound/summary`
- Exibe volume inbound, pendências desconhecidas e novos leads detectados.

## Impacto
- Sistema mais resistente a cenários de desligar/ligar diário.
- Menos risco de automação indevida em número pessoal/ruído.
- Rastreabilidade e auditabilidade aumentadas.
