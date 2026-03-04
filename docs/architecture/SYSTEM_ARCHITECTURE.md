# SYSTEM ARCHITECTURE (Dark Mode Enterprise)

## 1. Core Topology
- **web**: Next.js dashboard
- **api**: FastAPI (orquestração e regras)
- **worker**: execução assíncrona de automações
- **beat/scheduler**: tarefas periódicas idempotentes
- **db**: PostgreSQL
- **redis**: broker/cache/rate-limit state
- **baileys-gateway**: serviço Node para WhatsApp Web

## 2. Design Rules
1. Toda mutação crítica exige `idempotency_key`.
2. Todo webhook inbound é deduplicado por `external_message_id`.
3. Todo write relevante gera `audit_log`.
4. Sem ACK de entrega, sem commit de notificação enviada.

## 3. Event-Driven Flow (resumo)
1. Evento agendado entra na janela de notificação.
2. Worker publica comando outbound para baileys-gateway.
3. ACK confirmado -> evento marcado como notificado.
4. Resposta inbound do paciente entra por webhook interno.
5. Parser de intenção atualiza status (`confirmed|canceled|reschedule_requested`).

## 4. Uptime Strategy
- Healthchecks ativos por serviço
- Restart policy always
- Backoff exponencial em falhas externas
- Dead-letter queue para payload inválido
