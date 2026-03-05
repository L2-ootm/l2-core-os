# STARTUP CATCH-UP RUNBOOK

## Objetivo
Quando o PC da clínica é desligado à noite e ligado de manhã, o gateway deve retomar conexão e executar reconciliação inicial sem perda operacional.

## Configuração
- Variável: `STARTUP_CATCHUP_HOURS` (default 24)
- Define janela lógica de recuperação após reconnect.

## Comportamento
1. Gateway conecta WhatsApp.
2. Executa `runStartupCatchup()` automaticamente.
3. Processa mensagens de `upsert` com tipos `notify` e `append`.
4. Deduplica por `external_message_id`.
5. Atualiza métricas de catch-up no endpoint de status.

## Observabilidade
Endpoint: `GET /session/status`
Campos novos:
- `last_catchup_at`
- `last_catchup_recovered`
- `startup_catchup_hours`

## Critério operacional
- Se reconectar e `last_catchup_at` atualizar, ciclo de recuperação está ativo.
- Sempre validar `processed_inbound_ids` e fila humana pendente após manhã.
