# ANDROID SYNC STRATEGY (LOW-COST FIRST)

## Pergunta central
"Dá para operar sem gastar com hospedagem web?"

## Resposta curta
Sim. O caminho mais barato é **Android-first + sync local/remoto opcional**.

## Modelo recomendado (fase inicial)
### Opção A — Local-First (sem servidor pago)
- App Android roda como cliente principal
- API roda localmente (PC da clínica ou mini-PC)
- Android sincroniza via rede local (Wi-Fi) + fallback manual export/import

Prós:
- custo quase zero
- privacidade alta
Contras:
- depende da máquina local ligada

### Opção B — Híbrido barato
- Backend em VPS econômica (quando escalar)
- App Android como front operacional principal
- Web dashboard opcional para admin

Prós:
- acesso remoto real
- sincronização contínua
Contras:
- custo mensal de infra

## Sincronização (design técnico)
- Tabelas com `updated_at` + `version`
- Sync incremental por cursor (`last_sync_at`)
- Estratégia de conflito: "last write wins" com trilha de auditoria
- Operações críticas (status de consulta, confirmação) com idempotency key

## Segurança no mobile
- Device binding (vincular aparelho autorizado)
- Refresh token curto + rotação
- Criptografia local (SQLCipher/Keystore)

## Roadmap sugerido
1. MVP desktop/local estável
2. API sync pronta
3. App Android (Flutter/Kotlin) com módulos essenciais
4. Modo offline + reconciliação automática
5. Se tração: publicar painel web completo
