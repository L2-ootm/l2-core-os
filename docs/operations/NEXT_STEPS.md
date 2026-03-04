# NEXT STEPS (Execution)

## Fase 0 — Documentação fundacional
- [x] Arquitetura base
- [x] Segurança baseline
- [x] Integração WhatsApp (Baileys)
- [x] Estratégia de setup sem Git
- [x] Estratégia Android sync

## Fase 1 — Bootstrap técnico
- [x] Criar estrutura `apps/web`, `apps/api`, `apps/baileys-gateway`
- [x] Implementar `/health` na API
- [x] Implementar webhook inbound WhatsApp com dedup
- [x] Implementar tabela `inbound_messages`
- [ ] Implementar `l2-update` + rollback

## Fase 2 — Operação real
- [ ] Wizard de configuração in-app
- [ ] RBAC funcional (owner/operator/viewer)
- [ ] Rate limiting por IP/token
- [ ] Intent Router Lite (LLM barato) com budget diário
- [x] Endpoints base de configuração (`/config/schema|current|validate|apply`)
- [x] Sessão Baileys base real (QR/status/reconnect/outbound)

## Fase 3 — Android-first
- [x] Contrato de sync incremental
- [ ] App Android v0 com agenda + confirmações
- [ ] Offline mode + reconciliação
- [x] Endpoints base de sync (`/mobile/sync/pull|push`)
