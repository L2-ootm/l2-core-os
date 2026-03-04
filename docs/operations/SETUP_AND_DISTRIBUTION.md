# SETUP & DISTRIBUTION (NO-GIT FRIENDLY)

## Princípio
Usuário leigo não deve precisar instalar Git nem conhecer terminal avançado.

## Canais de distribuição
1. **GitHub Releases** (para devs)
2. **Mirror Download Page** (site oficial com botão "Baixar L2 Core OS")
3. **Installer Pack ZIP** com bootstrap incluso

## Installer Pack (conteúdo)
- `l2-setup.bat` (Windows)
- `l2-setup.sh` (Linux/macOS)
- `docker-compose.yml`
- `.env.example`
- `preflight-check` (verifica Docker ativo + portas)

## Fluxo de instalação (usuário final)
1. Baixar ZIP
2. Extrair pasta
3. Clicar duas vezes em `l2-setup.bat`
4. Preencher perguntas (telefone, timezone, credenciais)
5. Aguardar validação automática de saúde
6. Acessar dashboard em `http://localhost:3000`

## Atualização sem Git
- `l2-update.bat` baixa pacote incremental assinado
- Backup automático de `.env` e volume de dados
- Rollback simples para versão anterior
