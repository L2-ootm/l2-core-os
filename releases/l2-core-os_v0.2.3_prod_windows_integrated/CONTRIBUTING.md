# Contributing to L2 CORE OS

Thanks for contributing.

## Development Setup

1. Install Docker Desktop
2. Clone repository
3. Copy env template:
   - `copy infra\.env.example infra\.env`
4. Start stack:
   - `docker compose -f infra/docker-compose.yml --env-file infra/.env up -d`

## Branching

- Create feature branch from `main`
- Use clear branch names:
  - `feat/...`
  - `fix/...`
  - `docs/...`

## Commit Standard

Use concise Conventional Commit style:
- `feat: ...`
- `fix: ...`
- `docs: ...`
- `chore: ...`

## Pull Request Checklist

Before opening PR:
- [ ] Python syntax checks pass
- [ ] Node syntax checks pass
- [ ] `e2e-go-no-go.ps1` returns GO
- [ ] Documentation updated for behavioral changes
- [ ] No secrets in code or commits

## Design Principles

- Idempotency first
- Antifragile reconnect/recovery paths
- Secure-by-default endpoints
- Functional UI blocks over open-ended unsafe automation

## Testing Commands

- Python:
  - `python -m py_compile apps/api/main.py apps/api/core/config.py apps/api/core/ai_fallback.py apps/api/worker.py`
- Node:
  - `node --check apps/baileys-gateway/server.js`
  - `node --check apps/web/server.js`
- E2E:
  - `powershell -ExecutionPolicy Bypass -File infra/scripts/e2e-go-no-go.ps1`
