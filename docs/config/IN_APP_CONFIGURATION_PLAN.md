# IN-APP CONFIGURATION PLAN

## Princípio
Usuário não deve editar arquivo manualmente para tarefas comuns.

## Painel "Configurações do Sistema"
Seções:
1. Ambiente (timezone, portas lógicas, modo local/cloud)
2. Banco (testar conexão + salvar)
3. WhatsApp (status da sessão Baileys + reconectar QR)
4. Segurança (RBAC, limites, tokens internos)
5. Automações (janelas de lembrete, retries, templates)
6. Inteligência (modelo/threshold/budget diário)

## Arquitetura de configuração
- `.env` = bootstrap e segredos
- Tabela `app_settings` = parâmetros funcionais editáveis via UI
- Serviço de merge em runtime: `env defaults` + `db overrides`

## Endpoints sugeridos
- `GET /config/schema` -> dicionário de campos editáveis
- `GET /config/current` -> snapshot atual
- `POST /config/validate` -> valida sem persistir
- `POST /config/apply` -> aplica e audita mudança
- `POST /config/whatsapp/reconnect` -> reinicia sessão Baileys

## Segurança
- Apenas `owner` altera configuração crítica
- toda mudança cria `audit_log`
- segredos não retornam em texto puro no dashboard
