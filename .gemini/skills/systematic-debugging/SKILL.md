---
name: systematic-debugging
description: Diagnóstico tático de falhas no L2 CORE OS. Analisa traces do FastAPI, logs do Baileys, estados do Redis e erros de renderização no React para resolver bugs sistêmicos com rapidez.
---

# L2 CORE OS Systematic Debugging

## Protocolo de Diagnóstico
Siga estas fases para identificar por que uma funcionalidade (ex: Agenda ou Pipeline) não está se comportando como esperado.

1. **Investigar (Coleta de Inteligência)**:
   - Verifique os logs do container correspondente via `l2-control.bat logs [api|web|gateway]`.
   - Analise se o erro é de **Sincronização** (API-Gateway) ou de **Renderização** (React/Shadcn).
2. **Padrão (Análise de Assinatura)**:
   - O erro acontece apenas com novos clientes? Ou é um problema de estado global no Calendário?
   - Verifique se o `idempotency-key` está causando rejeições silenciosas.
3. **Hipótese (Teoria da Falha)**:
   - Formule por que a interatividade está "morta". Ex: "O componente de calendário não está escutando os updates do WebSocket do Baileys".
4. **Fix (Neutralização)**:
   - Aplique a correção técnica.
   - **Validação Crítica**: O fix quebrou a experiência do "usuário leigo"? (Ex: Mensagens de erro muito técnicas).
