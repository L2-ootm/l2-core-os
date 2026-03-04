# CONFIGURABILITY BLUEPRINT

## Objetivo
Tudo que for variável de operação deve ser configurável sem alterar código.

## Camadas de configuração
1. `.env` (infra e segredos)
2. `settings` no banco (parâmetros funcionais por tenant/unidade)
3. Painel Admin (edição assistida, com validação)

## Exemplos de parâmetros configuráveis
- Janela de lembrete (24h, 12h, 2h)
- Templates de mensagem (confirmar/cancelar/remarcar)
- Limites de rate limiting por plano
- Timeout de automação e número de retries
- Modelo LLM do Intent Router + limiar de confiança

## Política de segurança
- Segredos sensíveis somente em `.env`/secret manager
- Config funcional pode ir para banco
- Alterações via painel geram `audit_log`

## UX para usuário leigo
- Wizard inicial com 5 etapas
  1. Perfil da operação
  2. Banco de dados
  3. WhatsApp (QR + status)
  4. Mensagens e horários
  5. Teste final (simulação)
