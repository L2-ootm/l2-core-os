# UI Smoke E2E — Phase D

## Objetivo
Validar UX states + fluxos críticos após integração real da UI Lovable.

## Pré-requisitos
- Backend up (`api`, `db`, `redis`, `gateway`)
- Front Lovable rodando (`npm run dev`)

## Checklist

### 1) Dashboard
- [ ] KPIs carregam via API real
- [ ] Em falha de API, exibe estado de erro (não quebra layout)

### 2) Configurações
- [ ] Gerar token owner funciona
- [ ] Carregar config atual funciona
- [ ] Validar config mostra retorno
- [ ] Aplicar config executa em modo pessimistic (loading + resultado)
- [ ] Sem output: empty state visível

### 3) WhatsApp Inbox
- [ ] Status e classificações carregam
- [ ] Connect/Catch-up/Disconnect com loading state
- [ ] Em falha: rollback visual + error state
- [ ] Sem ação: empty state visível no painel de saída

### 4) Leads/Agenda/Financeiro
- [ ] Leads consome `/entities/list`
- [ ] Agenda consome `/events/list`
- [ ] Financeiro consome `/transactions/list` + `/finance/summary`

## Critério de aceite
- Nenhuma página crítica com dados mock hardcoded para blocos principais.
- Todos os fluxos exibem loading/error/empty coerentes.
- Ações críticas em modo pessimistic.
- Build frontend e GO/NO-GO backend verdes.
