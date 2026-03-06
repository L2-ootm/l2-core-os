# QUALITY CHECK INTEGRAL — CROSS-CHECK
**Data:** 2026-03-04
**Escopo:** código + contratos + infra + documentação

## 1) Checklist executado

### Static/Syntax checks
- Python compile check:
  - `apps/api/main.py`
  - `apps/api/worker.py`
  - `apps/api/core/config.py`
  - **Resultado:** ✅ PASS
- Node syntax check:
  - `apps/baileys-gateway/server.js`
  - `apps/web/server.js`
  - **Resultado:** ✅ PASS
- Docker Compose config render:
  - `infra/docker-compose.yml`
  - **Resultado:** ✅ PASS

### Cross-check de consistência
- README x arquitetura x código: ✅ coerente no macro
- Decisão WhatsApp (Baileys) refletida em código e docs: ✅
- Estratégia Android-first refletida em docs + endpoints base: ✅

## 2) Correções aplicadas durante o QA

1. **Removido warning de compose**
   - Remoção do campo obsoleto `version` do `docker-compose.yml`.

2. **Configuração hardcoded corrigida na API**
   - `config/current` agora retorna `TIMEZONE` e `BAILEYS_SESSION_NAME` a partir das configs reais, não valores fixos.

3. **Robustez de sync mobile**
   - `POST /mobile/sync/push` agora trata deduplicação por `device_id:sync_batch_id` e não quebra com replay.

4. **Baileys timestamp parsing hardening**
   - Parsing de `messageTimestamp` robusto (number/string/objeto), evitando `NaN` e timestamp inválido.

5. **Ambiente e higiene de repositório**
   - Adicionado `.gitignore` para evitar commit de `infra/.env`, cache Python e sessão `.auth`.

## 3) Achados abertos (prioridade)

### P1 — Segurança (gap entre docs e código)
- Docs falam de HMAC e RBAC; API ainda usa apenas `x-internal-token` em endpoints críticos.
- **Ação recomendada:**
  - implementar middleware de autenticação JWT + roles
  - assinatura HMAC de webhook inbound com janela anti-replay

### P1 — Rate limiting não implementado
- Está documentado, mas não aplicado no runtime.
- **Ação recomendada:** `slowapi` (FastAPI) + Redis para limiter distribuído.

### P2 — Config in-app ainda sem UI
- Endpoints existem (`/config/*`), mas painel/wizard não existe.
- **Ação recomendada:** implementar tela de settings com `validate -> apply`.

### P2 — Sync mobile ainda base
- Contrato existe, mas `pull` ainda é placeholder sem consulta incremental real por `updated_at`.
- **Ação recomendada:** modelar tabelas com `updated_at`, cursor e reconciliação.

## 4) Veredito de qualidade
**Status atual: GOOD FOUNDATION / NOT PRODUCTION-READY YET**

- Fundação técnica: **forte** ✅
- Confiabilidade inicial (dedup, reconnect): **boa** ✅
- Segurança/RBAC/rate-limit enterprise: **ainda incompleto** ⚠️
- Pronto para produção: **não ainda** ⛔

## 5) Próximo gate de qualidade (GO/NO-GO)
Para liberar "MVP operável controlado", faltam 4 itens obrigatórios:
1. JWT + RBAC funcional
2. rate limiting ativo
3. HMAC no webhook
4. teste E2E documentado (inbound/outbound + reconnect + replay dedup)
