# L2 CORE OS — FULL DOCUMENTATION

## 1. Visão Geral
L2 Core OS é uma infraestrutura agnóstica para operações de serviço com foco em:
- idempotência
- automação orientada a eventos
- segurança mínima enterprise
- operação simples para usuário leigo

## 2. Arquitetura
Serviços principais:
- `web` (wizard/admin MVP)
- `api` (FastAPI)
- `worker` / `beat` (automação)
- `db` (PostgreSQL)
- `redis`
- `baileys-gateway` (WhatsApp)

Arquivos-chave:
- `infra/docker-compose.yml`
- `docs/architecture/SYSTEM_ARCHITECTURE.md`

## 3. Segurança
Implementado:
- JWT + RBAC (owner/operator/viewer)
- rate limiting por IP/token
- webhook HMAC + anti-replay

Referências:
- `docs/security/SECURITY_BASELINE.md`
- `docs/operations/GATES_IMPLEMENTATION_REPORT_2026-03-04.md`

## 4. WhatsApp (Baileys)
Recursos:
- conexão real com persistência de sessão
- QR/status/reconnect
- inbound forwarding assinado
- outbound send

Referências:
- `docs/whatsapp/BAILEYS_INTEGRATION.md`
- `docs/whatsapp/BAILEYS_RUNBOOK.md`

## 5. Configuração
Camadas:
- `.env` (bootstrap e segredos)
- `app_settings` (overrides)
- wizard (MVP web)

Endpoints:
- `GET /config/schema`
- `GET /config/current`
- `POST /config/validate`
- `POST /config/apply`

## 6. Mobile Sync (Android-first)
Endpoints:
- `GET /mobile/sync/pull?since=...`
- `POST /mobile/sync/push`

Reconciliação:
- last-write-wins por `updated_at`
- dedup por `device_id:sync_batch_id`

Referências:
- `docs/mobile/SYNC_API_CONTRACT.md`
- `docs/mobile/ANDROID_SYNC_STRATEGY.md`

## 7. IA local e fallback
- política por tiers A/B/C
- benchmark preflight
- fallback determinístico obrigatório

Endpoints:
- `GET /ai/capability/policy`
- `POST /ai/triage`

Referências:
- `docs/architecture/AI_CAPABILITY_POLICY.md`

## 8. Setup e operação
Setup:
- `infra/scripts/l2-setup.bat`
- `infra/scripts/l2-setup.sh`

Preflight IA:
- `infra/scripts/preflight-ai.bat`
- `infra/scripts/preflight-ai.sh`

Validação E2E:
- `infra/scripts/e2e-go-no-go.ps1`
- `docs/operations/E2E_SMOKE_SCRIPT.md`

## 9. CI/CD
- GitHub Actions em `.github/workflows/ci.yml`

## 10. Estado atual
- GO/NO-GO: GO
- Pronto para MVP controlado local
- Próximo salto: app Android v0 + estado distribuído em Redis para rate/replay
