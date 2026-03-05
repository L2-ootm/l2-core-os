# L2 Control Center (Windows)

Script unificado de operação diária:
- `l2-control.bat` (na raiz do projeto)

## Design
O script foi construído para ser **idempotente e antifrágil**:
- detecta automaticamente a raiz do projeto
- autoabre Docker Desktop quando necessário
- tenta auto-recuperar `.env` ausente
- gera `.env` mínimo seguro se `infra/.env.example` não existir
- opera com retries em start seguro

## Recursos
1. Start seguro (up + health)
2. Stop
3. Restart seguro
4. Status consolidado (API + WhatsApp)
5. Logs rápidos (api/gateway/db)
6. GO/NO-GO
7. WhatsApp recover (reconnect + catch-up)
8. Abrir dashboard (prioriza UI principal em `apps/web-ui` em `http://localhost:8080`; fallback técnico `http://localhost:3000`)
9. Recriar `.env` (self-heal)

## Como usar
1. Execute `l2-control.bat` na raiz do projeto
2. Se faltar `.env`, o script auto-cria/corrige
3. Use opção 1 para start seguro e opção 6 para validação

## Cenários de erro tratados
- Se `infra/.env` estiver ausente, o script reconstrói automaticamente.
- Se `infra/.env.example` não existir, o script gera um `.env` mínimo seguro.
- Se o Docker não estiver ativo, tenta abrir Docker Desktop e aguarda readiness.
- Se o script for executado fora da raiz, ele tenta autodetectar a raiz (incluindo pasta pai).
