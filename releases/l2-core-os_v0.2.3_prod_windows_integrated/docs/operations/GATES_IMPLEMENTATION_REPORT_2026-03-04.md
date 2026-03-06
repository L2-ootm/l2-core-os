# GATES IMPLEMENTATION REPORT
**Data:** 2026-03-04

## Escopo
Implementação dos 4 gates obrigatórios de qualidade enterprise.

## Gate 1 — JWT + RBAC
Implementado na API (`apps/api/main.py`):
- `Authorization: Bearer <token>`
- `require_roles(...)` por endpoint
- roles ativas: `owner`, `operator`, `viewer`
- endpoint de bootstrap local: `POST /auth/dev-token?role=...`

Matriz atual:
- `config/schema`, `config/current`, `mobile/sync/pull`: owner/operator/viewer
- `config/validate`, `mobile/sync/push`: owner/operator
- `config/apply`: owner

## Gate 2 — Rate limiting ativo
Implementado middleware global:
- limite por IP (por minuto)
- limite por token (por minuto, quando bearer presente)
- retorno `429 rate_limit_exceeded`

Limites configuráveis via env:
- `RATE_LIMIT_IP_PER_MIN`
- `RATE_LIMIT_TOKEN_PER_MIN`

## Gate 3 — HMAC + anti-replay webhook
Implementado em `/webhooks/whatsapp/inbound`:
- headers obrigatórios:
  - `x-webhook-timestamp`
  - `x-webhook-signature`
- assinatura: `HMAC_SHA256(secret, "<timestamp>.<raw_body>")`
- janela anti-replay: `WEBHOOK_REPLAY_WINDOW_SECONDS`
- replay detectado => `409 webhook_replay_detected`

Gateway Baileys atualizado para assinar payloads outbound para API.

## Gate 4 — E2E documentado
Criado runbook de validação:
- `docs/operations/E2E_GATE_VALIDATION.md`

## Observação técnica
Rate limiter e replay cache estão em memória (nó único). Para cluster multi-réplica, migrar estado para Redis.
