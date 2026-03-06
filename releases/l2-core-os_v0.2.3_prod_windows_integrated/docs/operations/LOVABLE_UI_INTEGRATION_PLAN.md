# Lovable UI Integration Plan (l2-core-os-b5ec4413)

## 1) Mapeamento rápido do que chegou

Repo clonada em:
- `ui-lovable-b5ec4413/`

Stack detectada:
- Vite + React + TypeScript
- shadcn-ui + Tailwind + Radix
- React Router
- TanStack Query
- Recharts

Rotas/páginas já prontas (UI):
- Dashboard
- LeadsCRM
- Agenda
- WhatsAppInbox
- Financeiro
- Automação
- Documentos
- Configurações
- Auditoria

Estado atual:
- UI está bem estruturada visualmente
- Dados são majoritariamente mockados
- Não existe camada de integração real com API do core ainda

## 2) Estratégia de integração com o core atual

Objetivo:
- manter backend/API atual do L2 CORE OS
- usar UI Lovable como front principal
- substituir mocks por dados reais endpoint a endpoint

### Fase A — Fundação (rápida)
1. Definir `VITE_API_BASE_URL`
2. Criar cliente HTTP central (`src/lib/api.ts`)
3. Criar hooks por domínio (`src/hooks/api/*`)
4. Adicionar interceptador de auth bearer token

### Fase B — Prioridade operacional
1. Dashboard
   - integrar KPIs e gráficos
2. WhatsAppInbox
   - conectar status/QR/connect/disconnect/catchup
   - listar classificações e pendências
3. Configurações
   - usar `/config/current|validate|apply`

### Fase C — Core de negócio
1. Leads/CRM (dados reais + pipeline)
2. Agenda (eventos reais)
3. Financeiro (transactions reais + KPIs)
4. Documentos (geração PDF real)

### Fase D — Qualidade e segurança
1. Estados de erro/loading padronizados
2. optimistic/pessimistic UI por ação
3. E2E UI smoke + GO/NO-GO backend

## 3) Mapa de endpoints do backend para UI

- Dashboard/KPI:
  - `GET /ops/inbound/summary`
  - `GET /ops/leads/classifications`
- Config:
  - `GET /config/current`
  - `POST /config/validate`
  - `POST /config/apply`
- WhatsApp:
  - `GET /session/status` (gateway)
  - `GET /session/qr` (gateway)
  - `POST /session/connect` (gateway)
  - `POST /session/disconnect` (gateway)
  - `POST /session/catchup` (gateway)
- IA funcional:
  - `POST /ai/block-action`
- Financeiro/agenda/leads:
  - usar `entities/events/transactions` + próximos endpoints de listagem
- Documentos:
  - `POST /documents/generate`

## 4) Gap técnico identificado

Para integração plena da UI Lovable, backend ainda precisa:
- endpoints de listagem/paginação para leads, agenda e transações
- filtros por período/status
- endpoint de inbox conversas/mensagens (separado do gateway)

## 5) Decisão de estrutura no projeto

Manter assim:
- `apps/api` (backend principal)
- `apps/baileys-gateway` (gateway WhatsApp)
- `ui-lovable-b5ec4413` (front moderno principal)

Depois, quando estabilizar:
- mover/renomear `ui-lovable-b5ec4413` para `apps/web-next` (ou `apps/web-ui`)

## 6) Próximo passo imediato

Implementar Fase A + B:
- base API client
- auth token flow
- Dashboard/WhatsApp/Config com dados reais
