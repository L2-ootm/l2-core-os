L2 CORE OS — INSTALAÇÃO RÁPIDA (Windows)

1) Pré-requisitos
- Docker Desktop instalado e aberto
- Internet ativa no primeiro setup

2) Primeira execução
- Abra a pasta do projeto
- Entre em: infra\scripts
- Clique 2x em: l2-setup.bat

3) Acesso
- Painel/Wizard: http://localhost:3000
- API: http://localhost:8000/health
- WhatsApp Gateway: http://localhost:8090/health

4) Teste de qualidade (GO/NO-GO)
- Execute no PowerShell (na raiz do projeto):
  powershell -ExecutionPolicy Bypass -File infra/scripts/e2e-go-no-go.ps1
- Resultado esperado: GO/NO-GO: GO

5) Observações importantes
- O arquivo infra\.env contém configurações locais/sensíveis.
- Não compartilhar infra\.env publicamente.
- Para IA local: rode preflight-ai.bat para detectar tier recomendado.

6) Suporte operacional
- Se algum serviço cair, rode:
  docker compose -f infra/docker-compose.yml --env-file infra/.env up -d
- Para logs:
  docker compose -f infra/docker-compose.yml --env-file infra/.env logs api --tail 100
  docker compose -f infra/docker-compose.yml --env-file infra/.env logs baileys-gateway --tail 100
