# WhatsApp Intra-App + Configurações Centralizadas

## O que foi implementado

### Dashboard integrado (web)
- Seção de configurações do sistema (`/config/current`, validate/apply)
- Seção WhatsApp intra-app com botões:
  - Status
  - Ver QR
  - Conectar
  - Catch-up agora
  - Desconectar
  - Trocar número (reset de auth)
- Seção de classificações de leads
- Seção de IA por blocos funcionais

### Gateway WhatsApp
- `POST /session/disconnect` (com `clearAuth=true` para trocar número)
- `POST /session/catchup` (reconciliação manual)
- `GET /session/status` com métricas de catch-up e deduplicação

### API operacional
- `GET /ops/leads/classifications`
- `GET /ops/inbound/summary`

## Observação de produto
A aplicação já tem página de configurações na prática (dashboard web atual), e agora ela também gerencia WhatsApp, IA funcional e classificações operacionais.

Próxima evolução: separar em rotas dedicadas (`/settings`, `/whatsapp`, `/leads`) com layout mais robusto.
