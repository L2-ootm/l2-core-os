# L2 CORE OS

> Infraestrutura Open Source agnóstica para operações de serviço.

## Status
- Arquitetura aprovada
- Escopo inicial definido
- Documentação fundacional em construção

## Decisões consolidadas (v1)
- Canal WhatsApp: **Baileys** (não Evolution API)
- Banco: PostgreSQL (local via Docker) com opção Supabase (cloud)
- Backend: FastAPI (Python)
- Frontend: Next.js
- Automação: workers Python + Redis
- Segurança: JWT + RBAC minimalista + rate limiting por IP/token
- Configuração: **tudo parametrizável** via `.env` + `settings` no app + wizard de onboarding
- Estratégia mobile: **Android-first com sync incremental** (low-cost, sem depender de site hospedado no início)

## Objetivo do projeto
Construir o backend invisível para clínicas e serviços com:
- Idempotência operacional
- Automação orientada a eventos
- Setup simples para usuário leigo
- Padrão de engenharia enterprise

## Estrutura
- `docs/architecture/` -> arquitetura, dados, eventos
- `docs/operations/` -> setup, deploy, runbooks
- `docs/security/` -> RBAC, rate limiting, hardening
- `docs/whatsapp/` -> integração Baileys (inbound/outbound)
- `infra/` -> docker-compose, templates de env, scripts

## Distribuição além do GitHub (aprovado)
Para reduzir fricção de instalação:
1. **Installer Pack (ZIP)** com tudo pronto
2. Script único `l2-setup` (Windows/Linux)
3. Atualização via `l2-update` sem exigir Git
4. Canal de distribuição alternativo: release espelho + site oficial de download

## Próximo passo imediato
Fechar documentação v0.1 e, em seguida, publicar o Installer Pack beta.
