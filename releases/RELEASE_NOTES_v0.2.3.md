# L2 CORE OS v0.2.3 (Integrated Backend + Lovable UI)

## Backend (core)
- Endpoints de listagem e resumo financeiro para integração real:
  - `GET /entities/list`
  - `GET /events/list`
  - `GET /transactions/list`
  - `GET /finance/summary`
- Base operacional já com idempotência/antifragilidade e GO/NO-GO validado.

## UI (Lovable integration)
- Integração real de páginas críticas:
  - Dashboard
  - WhatsApp Inbox
  - Configurações
  - Leads CRM
  - Agenda
  - Financeiro
- Estados de UX fase D:
  - loading / error / empty
  - handling optimistic/pessimistic em ações operacionais
- Proxy Vite configurado para API (`/api`) e gateway WhatsApp (`/wa`).

## Referências de commit
- Core repo: `feb8a1b`
- UI repo: `1fc41cd`

## Artifact
- `l2-core-os_v0.2.3_prod_windows_integrated.zip`
