# MASTER EXECUTION PLAN — L2 CORE OS

## Objetivo
Levar o projeto de fundação técnica para MVP operável de produção controlada, com custo inicial mínimo e arquitetura Android-first + fallback robusto.

## Princípios
1. Operação nunca para (fallback > perfeição)
2. Segurança mínima enterprise desde cedo
3. Simplicidade para usuário leigo
4. Evidência técnica auditável por sprint

## Fases

### Fase 1 — Core Operável (em execução)
- API segura (JWT/RBAC/HMAC/rate-limit) [feito]
- WhatsApp gateway com sessão real e reconnect [feito]
- Política de IA local + fallback determinístico [iniciando]
- Preflight de hardware para definir tier IA [iniciando]
- Wizard de configuração in-app (backend pronto, UI pendente)

### Fase 2 — Produto vendável (próximo)
- Sync incremental real com resolução de conflitos
- UI Admin de configurações
- Testes E2E automatizados + CI gates
- Pacote instalável no-git-friendly (ZIP + setup + update)

### Fase 3 — Android-first completo
- App Android com cache local e sync robusto
- Fluxo offline-first
- Device binding + revogação remota

## Critérios de sucesso (MVP)
- Setup em até 20 min em máquina limpa
- Fluxo WhatsApp inbound/outbound estável
- Fallback sem LLM mantendo operação funcional
- Zero vulnerabilidade crítica aberta

## Backlog imediato (7 dias)
1. Política de capacidade IA e scripts de benchmark
2. Endpoint de triagem fallback (determinístico)
3. CI GitHub Actions (lint/check/security básico)
4. Teste guiado E2E com evidência
