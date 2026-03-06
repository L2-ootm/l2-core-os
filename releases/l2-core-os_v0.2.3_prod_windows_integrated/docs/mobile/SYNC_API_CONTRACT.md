# SYNC API CONTRACT (ANDROID-FIRST)

## Objetivo
Sincronizar dados do app Android com o Core OS sem depender de hosting caro na fase inicial.

## Estratégia
- Sync incremental por cursor (`last_sync_at`)
- Operações de escrita com `idempotency_key`
- Confirmação de lote por `sync_batch_id`

## Endpoints
### `GET /mobile/sync/pull?since=ISO_DATE`
Retorna mudanças de `entities`, `events`, `transactions` desde o cursor.

### `POST /mobile/sync/push`
Recebe lote de mudanças do app:
```json
{
  "sync_batch_id": "batch_001",
  "device_id": "android_a52",
  "changes": [
    {
      "resource": "events",
      "operation": "update",
      "idempotency_key": "evt_123_status_confirm",
      "payload": {"id": "...", "status": "confirmed", "updated_at": "..."}
    }
  ]
}
```

### `POST /mobile/device/bind`
Vincula aparelho autorizado ao tenant/owner.

## Resolução de conflito
- Default: `last_write_wins`
- Em recursos críticos: marcar conflito e exigir validação manual

## Segurança mobile
- JWT + refresh token rotativo
- device binding obrigatório
- revogação remota de sessão por aparelho
