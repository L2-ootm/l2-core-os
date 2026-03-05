# E2E GATE VALIDATION (GO/NO-GO)

## Objetivo
Validar os 4 gates obrigatórios:
1. JWT + RBAC
2. Rate limiting
3. HMAC + anti-replay no webhook
4. Fluxo E2E documentado

## Pré-requisito
- Stack de pé (`docker compose ... up -d`)
- API em `http://localhost:8000`
- Gateway Baileys em `http://localhost:8090`

## 1) JWT + RBAC
### 1.1 Emitir token owner
curl -s -X POST http://localhost:8000/auth/dev-token?role=owner

### 1.2 Emitir token viewer
curl -s -X POST http://localhost:8000/auth/dev-token?role=viewer

### 1.3 Testes de permissão
- viewer em `/config/current` => 200
- viewer em `/config/apply` => 403
- owner em `/config/apply` => 200

## 2) Rate limiting
Rodar 65 requests rápidas no mesmo minuto em endpoint protegido sem token e validar 429 em parte delas.

PowerShell exemplo:
for ($i=0; $i -lt 65; $i++) { try { iwr http://localhost:8000/config/schema -UseBasicParsing | Out-Null } catch { $_.Exception.Response.StatusCode.value__ } }

## 3) HMAC + anti-replay
### 3.1 Teste assinatura inválida
POST `/webhooks/whatsapp/inbound` com assinatura fake => 401

### 3.2 Teste assinatura válida
Enviar payload assinado com timestamp atual => 200

### 3.3 Replay
Reenviar exatamente mesma assinatura/timestamp => 409 (`webhook_replay_detected`)

## 4) E2E WhatsApp flow (mínimo)
1. `GET /session/status` no gateway
2. Se necessário, conectar QR
3. Simular inbound (`/simulate/inbound`) com payload assinado
4. Validar resposta da API com intent
5. Testar outbound (`/outbound/send`) com sessão conectada

## Critério GO
- Todos os 4 gates com resultado esperado.

## Critério NO-GO
- Qualquer falha em autenticação, replay-protection, limiter ou deduplicação.
