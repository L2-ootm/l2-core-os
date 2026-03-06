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
- [x] Wizard de configuração in-app (MVP web)
- [x] RBAC funcional (owner/operator/viewer)
- [x] Rate limiting por IP/token
- [x] Intent Router Lite (fallback determinístico)
- [x] IA funcional por blocos (confirm/cancel/reschedule/triage)
- [x] Endpoints base de configuração (`/config/schema|current|validate|apply`)
- [x] Sessão Baileys base real (QR/status/reconnect/outbound)
- [x] HMAC + anti-replay em webhook inbound
- [x] Automação inbound -> status do evento
- [x] E2E gate validation documentado e executado (GO)

## Fase 3 — Android-first
- [x] Contrato de sync incremental
- [ ] App Android v0 com agenda + confirmações
- [x] Offline mode + reconciliação (base de conflito LWW por `updated_at` no backend)
- [x] Endpoints base de sync (`/mobile/sync/pull|push`) com aplicação real no push
