# L2 CORE OS

Infraestrutura Open Source agnóstica para operações de serviço (go-to-market inicial: clínicas).

## Status
- MVP controlado validado (GO/NO-GO)
- API segura com JWT/RBAC + rate limiting + webhook HMAC anti-replay
- WhatsApp gateway com sessão, reconnect, catch-up e controles intra-app
- Sync incremental mobile (pull/push) com reconciliação LWW por `updated_at`
- IA funcional por blocos (sem chat livre)

## Stack
- Frontend/dashboard: Node/Express (MVP UI)
- Backend: FastAPI (Python)
- Workers: Celery + Redis
- Banco: PostgreSQL
- WhatsApp: Baileys gateway
- Infra: Docker Compose

## Princípios de arquitetura
- Idempotência operacional em ações críticas
- Antifragilidade para reconnect/restart diário
- Automação orientada a eventos
- Operação segura com auditoria

## Quickstart (local)
1. Instale e abra o Docker Desktop
2. Clone o repositório
3. Copie env de exemplo:
   - `copy infra\.env.example infra\.env` (Windows)
4. Suba os serviços:
   - `docker compose -f infra/docker-compose.yml --env-file infra/.env up -d`
5. Acesse:
   - Dashboard: http://localhost:3000
   - API health: http://localhost:8000/health
   - Gateway status: http://localhost:8090/session/status

## Validação de qualidade
Execute:
- `powershell -ExecutionPolicy Bypass -File infra/scripts/e2e-go-no-go.ps1`

Resultado esperado:
- `GO/NO-GO: GO`

## Funcionalidades principais
- Configurações centralizadas no dashboard
- Controle WhatsApp intra-app (status, QR, conectar, desconectar, trocar número, catch-up)
- Classificação operacional de contatos (`known_client`, `new_lead`, `unknown`)
- Criação de `service_request` para novos pedidos de clientes existentes
- Geração de PDF por script com checksum (contratos/documentos)

## Segurança e compliance
- Não versionar `.env` nem segredos
- Revisar termos da plataforma de mensageria antes de uso em produção
- Manter logs de auditoria para ações automáticas

## Estrutura
- `apps/api/` backend e regras de domínio
- `apps/baileys-gateway/` integração WhatsApp
- `apps/web/` dashboard MVP
- `infra/` compose, env, scripts
- `docs/` arquitetura, operações, segurança e runbooks

## Release
- Tag atual: `v0.2.0`
- Pacote local: `L2_CORE_OS_v0.2.0_MVP_2026-03-05.zip`
