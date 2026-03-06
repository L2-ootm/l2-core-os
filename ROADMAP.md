# L2 Core OS — ROADMAP

> **Projeto:** L2 Core OS — Sistema SaaS de Gestão Inteligente para Clínicas Odontológicas  
> **Stack:** React/TypeScript · Python/FastAPI · PostgreSQL · Redis · Docker · WhatsApp (Baileys)  
> **Status:** Em desenvolvimento ativo  
> **Última atualização:** 2026-03-06

---

## ✅ Fases Concluídas

### Fase 1–5: Fundação
- [x] Setup do repositório com monorepo (`apps/api`, `apps/web-ui`, `apps/baileys-gateway`)
- [x] Docker Compose com PostgreSQL, Redis, e Baileys Gateway
- [x] Schema SQL com `entities`, `events`, `transactions`, `audit_logs`, `app_settings`
- [x] API FastAPI com endpoints CRUD (entities, events, transactions)
- [x] Sistema de autenticação com roles (`owner`, `operator`, `viewer`) via JWT

### Fase 6–10: Frontend Core
- [x] Design System "Precisão Clínica" com CSS variables e glassmorphism
- [x] Dashboard com KPIs dinâmicos (pacientes, agendamentos, receita, pendências)
- [x] Módulo Agenda — visualização mensal e operacional com drag-and-drop
- [x] Módulo Clientes — Pipeline Kanban (Novo → Qualificado → Agendado → Fechado → Perdido)
- [x] Módulo Financeiro — tabela de transações com filtros e resumo

### Fase 11–15: WhatsApp Integration
- [x] Baileys Gateway com endpoints (`/session/connect`, `/session/status`, `/outbound/send`)
- [x] Webhook de inbound messages com HMAC signature verification
- [x] Idempotency layer com Redis cache para dedup de mensagens
- [x] QR Code modal para conexão via celular da clínica
- [x] WhatsApp Inbox (CRM) — fila de revisão humana com interface de chat

### Fase 16–20: Automação & IA
- [x] Hardware Scanner (CPU, RAM, GPU) via WMI para aprovação de AI local
- [x] Integração com Ollama — download de modelos com progress bar
- [x] Predições matemáticas: No-Show Probability e Lead Scoring (Bayesian)
- [x] Go/No-Go Checklist operacional
- [x] Audit Logging system

### Fase 21–23: Localização & Theme
- [x] Migração completa para pt-BR (todos os componentes)
- [x] Theme "Precisão Clínica" — light theme com variáveis CSS
- [x] Remoção de referências hardcoded ao dark theme

### Fase 24–26: WhatsApp CRM Refinement
- [x] Lead Identification Modal (vincular nome a número)
- [x] Consolidação de mensagens por telefone (anti-duplicação no webhook)
- [x] Endpoint `/ops/leads/identify` para registro formal de leads
- [x] Retroactive Thread Merger — script PostgreSQL para consolidar threads fragmentadas
- [x] Purge de entradas de grupo (`@g.us`, `@newsletter`, `@broadcast`)

### Fase 27–29: Polimento CRM & Antifragilidade
- [x] **Filtro de Grupos Blindado** — `@g.us`, `participant`, `pushName`, `isGroup`
- [x] **Persistência de Mensagens Enviadas** — endpoint `POST /human-review/{id}/append-outbound`
- [x] **Lead Name Resolution** — `LEFT JOIN entities` no `/human-review/list`
- [x] **Real-time Polling** — inbox atualiza a cada 5 segundos
- [x] **Chat Bubbles Persistentes** — parseamento de `[L2]:` para outbound messages
- [x] **Badges Interativos** — dropdown com "Identificar Lead", "Definir como Cliente", "Resolver", "Ignorar"
- [x] **Layout Fixo Anti-frágil** — scroll interno isolado, sem expansão da UI
- [x] **Debug Log Removido** — JSON raw eliminado da página
- [x] **Busca Funcional** — filtra por nome, telefone e conteúdo
- [x] **Fix: Lead não desaparece** ao ser identificado (auto-resolve removido)
- [x] **Fix: async/sync crash** no endpoint de persistência de outbound
- [x] **Fix: unknown_phone** — display "Número Desconhecido"
- [x] **Normalização de Telefones** — 18 entities normalizadas (remoção de `+`)
- [x] **Delete Entity** — endpoint `POST /entities/delete` com cascade cleanup
- [x] **Modal de Confirmação** — in-app modal para exclusão de clientes (substituiu `confirm()`)

---

## 🚧 Em Progresso

- [ ] Brainstorming de melhorias e novas funcionalidades (Kilocode Agent)

---

## 🔮 Próximas Fases (Planejadas)

### Fase 30+: Melhorias Pendentes
- [ ] Módulo de Documentos — Templates editáveis, assinatura digital
- [ ] Notificações Push — lembrete de consulta via WhatsApp (24h antes)
- [ ] Relatórios Avançados — gráficos de receita mensal, taxa de no-show, funil de leads
- [ ] Mobile Responsiveness — otimização completa para tablets e smartphones
- [ ] Multi-clínica — suporte a múltiplas unidades com permissões separadas
- [ ] Integração com APIs externas — Google Calendar, sistemas de pagamento
- [ ] Backup automatizado com restore point
- [ ] Dark Mode toggle (já preparado com CSS variables)

---

*Gerado automaticamente pelo L2 Core OS Development Pipeline*
