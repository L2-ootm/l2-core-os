# L2 CORE OS v0.2.2

## Highlights
- `l2-control.bat` hardening (idempotente + antifrágil):
  - auto-detecta raiz do projeto
  - auto-recria `infra/.env` quando ausente
  - gera `.env` mínimo seguro se `.env.example` não existir
  - tenta abrir Docker Desktop e aguarda readiness
  - start seguro com auto-recuperação e diagnóstico
  - suporte a modo não interativo por flags (`--start`, `--go`, `--status`, etc.)
- Documentação do Control Center atualizada.

## Artifact
- `l2-core-os_v0.2.2_prod_windows.zip`

## Validation
- Fluxo de startup com ausência de `.env` tratado por self-heal.
- GO/NO-GO mantido no baseline operacional.
