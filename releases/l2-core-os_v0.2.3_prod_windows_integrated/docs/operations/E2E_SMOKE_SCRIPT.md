# E2E SMOKE (manual rápido)

## 1) Subir stack
`docker compose -f infra/docker-compose.yml --env-file infra/.env up -d`

## 2) Health
- `GET http://localhost:8000/health`
- `GET http://localhost:8090/health`
- `GET http://localhost:3000/`

## 3) Gerar token owner
`POST /auth/dev-token?role=owner`

## 4) Config wizard
- Abrir `http://localhost:3000`
- Gerar token
- Validar e aplicar override

## 5) Upserts + sync incremental
Com bearer owner:
- `POST /entities/upsert`
- `POST /events/upsert`
- `POST /transactions/upsert`
- `GET /mobile/sync/pull?since=1970-01-01T00:00:00+00:00`

## 6) IA fallback
- `GET /ai/capability/policy`
- `POST /ai/triage` com texto "confirmo"

## 7) Webhook assinatura
- enviar inbound assinado via gateway `/simulate/inbound`
- validar dedup/replay
