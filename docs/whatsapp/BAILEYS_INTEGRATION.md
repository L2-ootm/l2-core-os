# WHATSAPP INTEGRATION — BAILEYS

## Objetivo
Operar envio e recebimento de mensagens WhatsApp com confiabilidade e rastreabilidade, sem dependência da Evolution API.

## Componentes
- `baileys-gateway` (Node.js + Baileys)
- `api` (FastAPI) para comandos e persistência
- `redis` para fila transitória e retry

## Contratos mínimos
### Outbound command (API -> gateway)
```json
{
  "idempotency_key": "evt_123_notify_2026-03-04",
  "phone": "+55...",
  "message": "Olá, confirme sua consulta respondendo CONFIRMO.",
  "context": {"entity_id": "...", "event_id": "..."}
}
```

### Inbound event (gateway -> API)
```json
{
  "external_message_id": "ABCD1234",
  "phone": "+55...",
  "text": "Confirmo",
  "timestamp": "2026-03-04T10:00:00Z",
  "raw": {}
}
```

## Regras de processamento
1. Validar assinatura interna do gateway.
2. Deduplicar por `external_message_id`.
3. Classificar intenção (`confirm`, `cancel`, `reschedule`, `other`).
4. Atualizar `events.status` em transação atômica.
5. Registrar auditoria.

## Watchdog
- Detecta socket degradado
- Reinicia sessão com cooldown
- Reidrata fila pendente
- Evita duplicata via `idempotency_key`
